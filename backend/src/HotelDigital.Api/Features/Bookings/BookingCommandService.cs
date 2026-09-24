using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using HotelDigital.Api.Infrastructure.Time;
using HotelDigital.Api.Features.Invoices;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Features.Bookings;

public sealed class BookingCommandService(
    HotelDbContext db,
    IAuditWriter auditWriter,
    ITransactionExecutor transactionExecutor,
    InvoiceLifecycleService invoiceLifecycle)
{
    public async Task<long> CreateAsync(
        BookingWriteRequest request,
        CancellationToken cancellationToken)
    {
        request = await WithDefaultChannelAsync(request, cancellationToken);
        BookingValidator.Validate(request, requireVersion: false);
        var hotelNow = HotelClock.Now();
        if (request.BookingMode == "WALK_IN"
            && (request.CheckInAt > hotelNow || request.CheckOutAt <= hotelNow))
            throw new BusinessRuleException("walk_in_outside_stay", "Khách nhận phòng tại quầy cần có lịch ở bao gồm thời điểm hiện tại.");

        return await transactionExecutor.ExecuteAsync(async token =>
        {
            await EnsureReferencesAsync(request, token);
            var roomIds = new[] { request.RoomId }.Concat(request.AdditionalRoomIds ?? []).Distinct().ToArray();
            var selectedRooms = await db.Rooms.AsNoTracking()
                .Where(x => roomIds.Contains(x.RoomId) && x.IsActive && x.CountsTowardOccupancy && x.RoomType.IsActive)
                .Select(x => new { x.RoomId, x.RoomType.Capacity })
                .ToListAsync(token);
            if (selectedRooms.Count != roomIds.Length)
                throw new BusinessRuleException("room_unavailable", "Một hoặc nhiều phòng không tồn tại hoặc đã ngừng hoạt động.");
            var capacities = selectedRooms.ToDictionary(x => x.RoomId, x => (int)x.Capacity);
            var guestsByRoom = DistributeGuests(request.GuestCount, roomIds, capacities);
            foreach (var roomId in roomIds)
                await EnsureRoomAvailableAsync(roomId, request.CheckInAt, request.CheckOutAt, null, token);

            Customer? newCustomer = null;
            if (request.NewCustomer is not null)
            {
                var input = request.NewCustomer;
                await EnsureNewCustomerIdentityAvailableAsync(input.IdentityDocument, token);
                newCustomer = new Customer
                {
                    FullName = input.FullName.Trim(), Phone = Clean(input.Phone), Email = Clean(input.Email),
                    IdentityDocument = Clean(input.IdentityDocument), Nationality = Clean(input.Nationality),
                    Note = Clean(input.Note), IsActive = true
                };
                db.Customers.Add(newCustomer);
            }
            var groupCode = roomIds.Length > 1 ? $"GRP-{HotelClock.Now():yyyyMMdd}-{Guid.NewGuid():N}"[..25].ToUpperInvariant() : null;
            var bookings = roomIds.Select(roomId =>
            {
                var item = new Booking();
                if (request.CustomerId.HasValue) item.CustomerId = request.CustomerId.Value; else item.Customer = newCustomer!;
                BookingMutation.Apply(item, request, includeInitialPayments: true);
                item.RoomId = roomId;
                item.GuestCount = guestsByRoom[roomId];
                item.GroupCode = groupCode;
                item.Status = request.BookingMode == "WALK_IN" ? "CHECKED_IN" : "BOOKED";
                return item;
            }).ToList();
            foreach (var booking in bookings) AddInitialPayments(booking, request);
            db.Bookings.AddRange(bookings);

            await SaveWithBusinessErrorsAsync(token);
            foreach (var booking in bookings)
            {
                var invoiceResult = await invoiceLifecycle.EnsureAsync(booking, issue: false, token);
                AuditInvoiceLifecycle(invoiceResult);
            }
            if (newCustomer is not null)
            {
                auditWriter.Add("CREATE", "Customer", newCustomer.CustomerId.ToString(), new
                {
                    fields = new[] { "FullName", "Phone", "Email", "IdentityDocument", "Nationality", "Note" }
                });
            }
            foreach (var booking in bookings) auditWriter.Add("CREATE", "Booking", booking.BookingId.ToString(), new
            {
                booking.RoomId,
                booking.CustomerId,
                booking.ChannelId,
                booking.CheckInAt,
                booking.CheckOutAt,
                booking.BilledNights,
                booking.GuestCount,
                booking.Status,
                booking.GroupCode
            });
            foreach (var payment in bookings.SelectMany(x => x.Payments)) auditWriter.Add("CREATE", "Payment", payment.PaymentId.ToString(), new
            {
                payment.BookingId,
                payment.Amount,
                payment.Method,
                payment.PaidAt
            });
            await db.SaveChangesAsync(token);
            return bookings[0].BookingId;
        }, cancellationToken);
    }

    public async Task UpdateAsync(
        long id,
        BookingWriteRequest request,
        CancellationToken cancellationToken)
        => await UpdateCoreAsync(id, request, null, cancellationToken);

    public async Task UpdateWithRefundAsync(
        long id,
        BookingWriteRequest request,
        IReadOnlyList<BookingRefundInput> refunds,
        CancellationToken cancellationToken)
        => await UpdateCoreAsync(id, request, refunds, cancellationToken);

    private async Task UpdateCoreAsync(
        long id,
        BookingWriteRequest request,
        IReadOnlyList<BookingRefundInput>? refunds,
        CancellationToken cancellationToken)
    {
        request = await WithDefaultChannelAsync(request, cancellationToken);
        BookingValidator.Validate(request, requireVersion: true);
        if (refunds is not null)
        {
            if (refunds.Count == 0 || refunds.Count > 3)
                throw new RequestValidationException(new Dictionary<string, string[]> { ["refunds"] = ["Chọn từ một đến ba phương thức hoàn."] });
            foreach (var refund in refunds) ValidateRefund(refund);
        }
        var version = BookingValidator.DecodeVersion(request.Version!);

        await transactionExecutor.ExecuteAsync(async token =>
        {
            var booking = await db.Bookings.Include(x => x.Invoice).Include(x => x.Payments)
                .SingleOrDefaultAsync(x => x.BookingId == id, token)
                ?? throw new ResourceNotFoundException("booking_not_found", "Không tìm thấy đặt phòng.");
            if (booking.Status is "CHECKED_OUT" or "CANCELLED" or "NO_SHOW")
                throw new BusinessRuleException(
                    "booking_is_closed",
                    "Đặt phòng đã kết thúc hoặc đã hủy nên không thể sửa nội dung.");
            if (refunds is not null && booking.Invoice?.Status == "ISSUED")
                throw new BusinessRuleException("issued_invoice_cannot_be_adjusted", "Hóa đơn đã phát hành; cần xử lý hóa đơn trước khi hoàn chênh lệch.");

            db.Entry(booking).Property(x => x.Version).OriginalValue = version;
            await EnsureReferencesAsync(request, token);
            await EnsureGuestCountFitsAsync(request.GuestCount, [request.RoomId], token);
            await EnsureRoomAvailableAsync(request.RoomId, request.CheckInAt, request.CheckOutAt, id, token);
            var collectedAmount = booking.Payments.Sum(x => x.Amount);
            var revisedTotal = request.PreviousDebt + request.RoomRevenue + request.ServiceRevenue
                + request.SurchargeAmount - request.DiscountAmount;
            var excess = collectedAmount + request.DebtAmount - revisedTotal;
            if (refunds is null && excess > 0)
                throw new BusinessRuleException(
                    "booking_total_below_settlement",
                    "Tổng mới thấp hơn tiền đã thu và công nợ. Hãy giảm công nợ hoặc ghi nhận hoàn phần chênh lệch.");
            if (refunds is not null)
            {
                if (request.DebtAmount > 0)
                    throw new RequestValidationException(new Dictionary<string, string[]>
                    {
                        ["debtAmount"] = ["Giảm công nợ về 0 trước khi ghi nhận hoàn tiền cho khách."]
                    });
                if (excess <= 0 || refunds.Sum(x => x.Amount) != excess)
                    throw new RequestValidationException(new Dictionary<string, string[]>
                    {
                        ["refunds"] = ["Tổng tiền hoàn phải đúng bằng phần đã thu và công nợ vượt tổng mới."]
                    });
                foreach (var group in refunds.GroupBy(x => x.Method.Trim().ToUpperInvariant()))
                    if (booking.Payments.Where(x => x.Method == group.Key).Sum(x => x.Amount) < group.Sum(x => x.Amount))
                        throw new RequestValidationException(new Dictionary<string, string[]>
                        {
                            ["refunds"] = ["Tiền hoàn theo một phương thức vượt tiền đã thu bằng phương thức đó."]
                        });
            }
            var changedFields = BookingMutation.GetChangedFields(booking, request);
            AssignCustomer(booking, request);
            BookingMutation.Apply(booking, request, includeInitialPayments: false);
            var refundPayments = new List<Payment>();
            if (refunds is not null)
            {
                foreach (var refund in refunds)
                {
                    var payment = new Payment
                    {
                        BookingId = booking.BookingId,
                        Amount = -refund.Amount,
                        Method = refund.Method.Trim().ToUpperInvariant(),
                        PaidAt = HotelClock.Now(),
                        ReferenceCode = Clean(refund.ReferenceCode),
                        Note = $"Hoàn chênh lệch: {refund.Reason.Trim()}"
                    };
                    booking.Payments.Add(payment);
                    refundPayments.Add(payment);
                }
                booking.CashAmount = booking.Payments.Where(x => x.Method == "CASH").Sum(x => x.Amount);
                booking.CardAmount = booking.Payments.Where(x => x.Method == "CARD").Sum(x => x.Amount);
                booking.TransferAmount = booking.Payments.Where(x => x.Method == "TRANSFER").Sum(x => x.Amount);
            }
            auditWriter.Add("UPDATE", "Booking", booking.BookingId.ToString(), new { fields = changedFields });

            try
            {
                await SaveWithBusinessErrorsAsync(token);
                foreach (var refundPayment in refundPayments)
                    auditWriter.Add("REFUND", "Payment", refundPayment.PaymentId.ToString(), new
                    {
                        refundPayment.BookingId, refundPayment.Amount, refundPayment.Method,
                        refundPayment.PaidAt, refundPayment.ReferenceCode, refundPayment.Note
                    });
                var invoiceResult = await invoiceLifecycle.EnsureAsync(booking, issue: false, token);
                AuditInvoiceLifecycle(invoiceResult);
                await db.SaveChangesAsync(token);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new ConflictException(
                    "booking_version_conflict",
                    "Đặt phòng đã được người khác cập nhật. Vui lòng tải lại trước khi lưu.");
            }

            if (request.NewCustomer is not null)
            {
                auditWriter.Add("CREATE", "Customer", booking.CustomerId.ToString(), new
                {
                    fields = new[] { "FullName", "Phone", "Email", "IdentityDocument", "Nationality", "Note" }
                });
                await db.SaveChangesAsync(token);
            }

            return true;
        }, cancellationToken);
    }

    public async Task ChangeStatusAsync(
        long id,
        string targetStatus,
        BookingStatusRequest request,
        CancellationToken cancellationToken)
    {
        var version = BookingValidator.DecodeVersion(request.Version);

        await transactionExecutor.ExecuteAsync(async token =>
        {
            var booking = await db.Bookings.Include(x => x.Payments).Include(x => x.Invoice)
                .SingleOrDefaultAsync(x => x.BookingId == id, token)
                ?? throw new ResourceNotFoundException("booking_not_found", "Không tìm thấy đặt phòng.");
            db.Entry(booking).Property(x => x.Version).OriginalValue = version;
            BookingMutation.EnsureTransition(booking.Status, targetStatus);
            BookingMutation.EnsureTransitionTime(booking, targetStatus, HotelClock.Now());
            if (targetStatus is "CANCELLED" or "NO_SHOW" && booking.Invoice?.Status == "ISSUED")
                throw new BusinessRuleException("issued_invoice_cannot_be_cancelled", "Hóa đơn đã phát hành; cần xử lý hóa đơn theo quy trình kế toán trước khi hủy booking.");
            if (targetStatus == "CHECKED_OUT")
            {
                var paidAmount = booking.Payments.Sum(x => x.Amount);
                if (paidAmount + booking.DebtAmount < booking.PreviousDebt + booking.GrossRevenue)
                    throw new BusinessRuleException(
                        "checkout_payment_required",
                        "Vui lòng thu đủ tiền hoặc chuyển phần còn lại sang công nợ trước khi check-out.");
            }
            var previousStatus = booking.Status;
            booking.Status = targetStatus;
            InvoiceLifecycleResult? invoiceResult = targetStatus switch
            {
                "CHECKED_IN" => await invoiceLifecycle.EnsureAsync(booking, issue: false, token),
                "CHECKED_OUT" => await invoiceLifecycle.EnsureAsync(booking, issue: true, token),
                "CANCELLED" or "NO_SHOW" => await invoiceLifecycle.VoidDraftAsync(booking, token),
                _ => null
            };
            auditWriter.Add("STATUS_CHANGE", "Booking", booking.BookingId.ToString(), new
            {
                from = previousStatus,
                to = targetStatus
            });
            if (invoiceResult is not null) AuditInvoiceLifecycle(invoiceResult);

            try
            {
                await SaveWithBusinessErrorsAsync(token);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new ConflictException(
                    "booking_version_conflict",
                    "Trạng thái đặt phòng đã thay đổi. Vui lòng tải lại.");
            }

            return true;
        }, cancellationToken);
    }

    public async Task DeleteAsync(
        long id,
        BookingDeleteRequest request,
        CancellationToken cancellationToken)
    {
        var version = BookingValidator.DecodeVersion(request.Version);

        await transactionExecutor.ExecuteAsync(async token =>
        {
            var booking = await db.Bookings
                .Include(x => x.Payments)
                .Include(x => x.Invoice)
                .SingleOrDefaultAsync(x => x.BookingId == id, token)
                ?? throw new ResourceNotFoundException("booking_not_found", "Không tìm thấy đặt phòng.");

            if (booking.Status is "CHECKED_IN" or "CHECKED_OUT")
                throw new BusinessRuleException(
                    "booking_cannot_be_deleted",
                    "Không thể xóa đặt phòng đang hoặc đã lưu trú. Hãy hủy đặt phòng nếu cần giữ lịch sử.");
            if (booking.Payments.Count > 0
                || booking.Invoice is { Status: not "DRAFT" }
                || (booking.Invoice is null && !string.IsNullOrWhiteSpace(booking.InvoiceNumber)))
                throw new BusinessRuleException(
                    "booking_has_financial_history",
                    "Không thể xóa đặt phòng đã phát sinh thanh toán hoặc hóa đơn.");

            if (booking.Invoice is not null)
            {
                auditWriter.Add("DELETE", "Invoice", booking.Invoice.InvoiceId.ToString(), new
                {
                    booking.Invoice.InvoiceNumber,
                    booking.Invoice.Status,
                    booking.Invoice.BookingId
                });
                db.Invoices.Remove(booking.Invoice);
                booking.InvoiceNumber = null;
            }

            db.Entry(booking).Property(x => x.Version).OriginalValue = version;
            auditWriter.Add("DELETE", "Booking", booking.BookingId.ToString(), new
            {
                booking.BookingCode,
                booking.RoomId,
                booking.CustomerId,
                booking.Status
            });
            db.Bookings.Remove(booking);

            try
            {
                await SaveWithBusinessErrorsAsync(token);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new ConflictException(
                    "booking_version_conflict",
                    "Đặt phòng đã được người khác cập nhật. Vui lòng tải lại trước khi xóa.");
            }

            return true;
        }, cancellationToken);
    }

    private async Task EnsureReferencesAsync(BookingWriteRequest request, CancellationToken cancellationToken)
    {
        var roomIsActive = await db.Rooms.AsNoTracking()
            .AnyAsync(x => x.RoomId == request.RoomId && x.IsActive && x.CountsTowardOccupancy && x.RoomType.IsActive, cancellationToken);
        if (!roomIsActive)
            throw new BusinessRuleException("room_unavailable", "Phòng không tồn tại hoặc đã ngừng hoạt động.");

        var channel = await db.Channels.AsNoTracking()
            .Where(x => x.ChannelId == request.ChannelId && x.IsActive)
            .Select(x => new { x.Category })
            .SingleOrDefaultAsync(cancellationToken);
        if (channel is null)
            throw new BusinessRuleException("channel_inactive", "Kênh đặt phòng không tồn tại hoặc đã ngừng hoạt động.");
        if (request.BookingMode == "WALK_IN" && channel.Category == "ONLINE")
            throw new BusinessRuleException("walk_in_channel_invalid", "Khách nhận phòng tại quầy không thể dùng kênh đặt online.");

        if (request.CustomerId.HasValue
            && !await db.Customers.AsNoTracking().AnyAsync(x => x.CustomerId == request.CustomerId && x.IsActive, cancellationToken))
        {
            throw new BusinessRuleException("customer_not_found", "Khách hàng đã chọn không còn tồn tại.");
        }
    }

    private static void AddInitialPayments(Booking booking, BookingWriteRequest request)
    {
        var paidAt = HotelClock.Now();
        AddPayment(booking, request.CashAmount, "CASH", paidAt);
        AddPayment(booking, request.CardAmount, "CARD", paidAt);
        AddPayment(booking, request.TransferAmount, "TRANSFER", paidAt);
    }

    private static void AddPayment(Booking booking, decimal amount, string method, DateTime paidAt)
    {
        if (amount <= 0) return;
        booking.Payments.Add(new Payment
        {
            Amount = amount,
            Method = method,
            PaidAt = paidAt,
            Note = "Tiền cọc khi tạo booking"
        });
    }

    private async Task<BookingWriteRequest> WithDefaultChannelAsync(BookingWriteRequest request, CancellationToken token)
    {
        request = request with
        {
            BookingMode = string.IsNullOrWhiteSpace(request.BookingMode)
                ? "RESERVATION"
                : request.BookingMode.Trim().ToUpperInvariant()
        };
        if (request.ChannelId > 0) return request;
        var defaultChannelId = await db.Channels.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Code == "DIRECT" ? 0 : x.Category == "OFFLINE" ? 1 : 2)
            .Select(x => (int?)x.ChannelId)
            .FirstOrDefaultAsync(token);
        if (!defaultChannelId.HasValue)
            throw new BusinessRuleException("default_channel_missing", "Chưa có kênh đặt phòng mặc định đang hoạt động.");
        return request with { ChannelId = defaultChannelId.Value };
    }

    private async Task EnsureRoomAvailableAsync(
        int roomId,
        DateTime checkInAt,
        DateTime checkOutAt,
        long? excludeBookingId,
        CancellationToken cancellationToken)
    {
        var maintenanceOverlap = await db.RoomBlocks.AsNoTracking().AnyAsync(x =>
            x.RoomId == roomId
            && x.IsActive
            && x.StartAt < checkOutAt
            && x.EndAt > checkInAt,
            cancellationToken);
        if (maintenanceOverlap)
            throw new BusinessRuleException(
                "room_under_maintenance",
                "Phòng đang có lịch bảo trì trong khoảng thời gian này.");

        var overlaps = await db.Bookings.AsNoTracking().AnyAsync(x =>
            x.RoomId == roomId
            && x.BookingId != excludeBookingId
            && x.Status != "CANCELLED"
            && x.Status != "NO_SHOW"
            && x.CheckInAt < checkOutAt
            && x.CheckOutAt > checkInAt,
            cancellationToken);

        if (overlaps)
            throw new BusinessRuleException(
                "room_time_conflict",
                "Phòng đã có đặt phòng trong khoảng thời gian này.");
    }

    private async Task EnsureGuestCountFitsAsync(
        short? guestCount,
        IReadOnlyCollection<int> roomIds,
        CancellationToken cancellationToken)
    {
        if (!guestCount.HasValue) return;
        var smallestCapacity = await db.Rooms.AsNoTracking()
            .Where(x => roomIds.Contains(x.RoomId))
            .MinAsync(x => (short?)x.RoomType.Capacity, cancellationToken);
        if (!smallestCapacity.HasValue || guestCount.Value <= smallestCapacity.Value) return;
        throw new RequestValidationException(new Dictionary<string, string[]>
        {
            ["guestCount"] = [$"Số khách mỗi phòng không được vượt quá sức chứa {smallestCapacity.Value} người của phòng đã chọn."]
        });
    }

    private static Dictionary<int, short?> DistributeGuests(
        short? totalGuests,
        IReadOnlyList<int> roomIds,
        IReadOnlyDictionary<int, int> capacities)
    {
        var counts = roomIds.ToDictionary(id => id, _ => 0);
        if (!totalGuests.HasValue)
            return counts.ToDictionary(x => x.Key, _ => (short?)null);

        if (totalGuests.Value > capacities.Values.Sum())
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                ["guestCount"] = [$"Tổng số khách không được vượt quá sức chứa {capacities.Values.Sum()} người của các phòng đã chọn."]
            });

        var remaining = totalGuests.Value;
        while (remaining > 0)
        {
            foreach (var roomId in roomIds)
            {
                if (remaining == 0) break;
                if (counts[roomId] >= capacities[roomId]) continue;
                counts[roomId]++;
                remaining--;
            }
        }
        return counts.ToDictionary(x => x.Key, x => x.Value == 0 ? (short?)null : (short)x.Value);
    }

    private static void ValidateRefund(BookingRefundInput refund)
    {
        var errors = new Dictionary<string, string[]>();
        if (refund.Amount <= 0 || decimal.Round(refund.Amount, 2) != refund.Amount)
            errors["refund.amount"] = ["Tiền hoàn phải lớn hơn 0 và có tối đa hai chữ số thập phân."];
        if (refund.Method?.Trim().ToUpperInvariant() is not ("CASH" or "CARD" or "TRANSFER"))
            errors["refund.method"] = ["Phương thức hoàn không hợp lệ."];
        if (string.IsNullOrWhiteSpace(refund.Reason) || refund.Reason.Trim().Length > 260)
            errors["refund.reason"] = ["Nhập lý do hoàn (tối đa 260 ký tự)."];
        if (refund.ReferenceCode?.Trim().Length > 100)
            errors["refund.referenceCode"] = ["Mã giao dịch tối đa 100 ký tự."];
        if (errors.Count > 0) throw new RequestValidationException(errors);
    }

    private async Task EnsureNewCustomerIdentityAvailableAsync(string? identityDocument, CancellationToken token)
    {
        var normalized = NormalizeToken(identityDocument);
        if (normalized.Length == 0) return;
        var candidates = await db.Customers.AsNoTracking()
            .Where(x => x.IsActive && x.IdentityDocument != null)
            .Select(x => new { x.CustomerId, x.IdentityDocument })
            .ToListAsync(token);
        var duplicate = candidates.FirstOrDefault(x => NormalizeToken(x.IdentityDocument) == normalized);
        if (duplicate is not null)
            throw new ConflictException("customer_identity_exists", $"CCCD/Passport đã thuộc hồ sơ khách ID {duplicate.CustomerId}. Hãy chọn hồ sơ khách có sẵn.");
    }

    private void AssignCustomer(Booking booking, BookingWriteRequest request)
    {
        if (request.CustomerId.HasValue)
        {
            booking.CustomerId = request.CustomerId.Value;
        }
        else
        {
            var input = request.NewCustomer!;
            var customer = new Customer
            {
                FullName = input.FullName.Trim(),
                Phone = Clean(input.Phone),
                Email = Clean(input.Email),
                IdentityDocument = Clean(input.IdentityDocument),
                Nationality = Clean(input.Nationality),
                Note = Clean(input.Note)
            };
            db.Customers.Add(customer);
            booking.Customer = customer;
        }
    }

    private async Task SaveWithBusinessErrorsAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (FindSqlException(exception)?.Number == 51002)
        {
            throw new BusinessRuleException(
                "room_time_conflict",
                "Phòng vừa được đặt trong khoảng thời gian này. Vui lòng chọn phòng khác.");
        }
        catch (DbUpdateException exception) when (FindSqlException(exception)?.Number == 51003)
        {
            throw new BusinessRuleException("room_unavailable", "Phòng đã ngừng hoạt động.");
        }
        catch (DbUpdateException exception) when (FindSqlException(exception)?.Number == 51004)
        {
            throw new BusinessRuleException("room_under_maintenance", "Phòng vừa có lịch bảo trì trong khoảng thời gian này.");
        }
    }

    private void AuditInvoiceLifecycle(InvoiceLifecycleResult result)
    {
        var action = result.Created ? "CREATE" : result.PreviousStatus == result.Invoice.Status ? "SYNC" : "STATUS_CHANGE";
        auditWriter.Add(
            action,
            "Invoice",
            result.Invoice.InvoiceId > 0 ? result.Invoice.InvoiceId.ToString() : $"booking:{result.Invoice.BookingId}",
            new
        {
            result.Invoice.InvoiceNumber,
            result.Invoice.BookingId,
            from = result.PreviousStatus,
            to = result.Invoice.Status,
            result.Invoice.GrossAmount,
            result.Invoice.PaidAmount
        });
    }

    private static SqlException? FindSqlException(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
            if (current is SqlException sqlException) return sqlException;
        return null;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string NormalizeToken(string? value) => new((value ?? string.Empty).Where(char.IsLetterOrDigit).Select(char.ToUpperInvariant).ToArray());
}
