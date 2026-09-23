using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using HotelDigital.Api.Infrastructure.Time;
using HotelDigital.Api.Features.Invoices;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Features.Payments;

public sealed class PaymentService(
    HotelDbContext db,
    IAuditWriter auditWriter,
    ITransactionExecutor transactionExecutor,
    InvoiceLifecycleService invoiceLifecycle)
{
    private static readonly string[] Methods = ["CASH", "CARD", "TRANSFER"];

    public async Task<IReadOnlyList<PaymentItem>> GetAsync(long bookingId, CancellationToken token) =>
        await db.Payments.AsNoTracking()
            .Where(x => x.BookingId == bookingId)
            .OrderByDescending(x => x.PaidAt)
            .ThenByDescending(x => x.PaymentId)
            .Select(x => new PaymentItem(
                x.PaymentId,
                x.BookingId,
                x.Amount,
                x.Method,
                x.PaidAt,
                x.ReferenceCode,
                x.Note,
                Convert.ToBase64String(x.Version)))
            .ToListAsync(token);

    public async Task<PaymentItem> CreateAsync(long bookingId, PaymentWriteRequest request, CancellationToken token)
    {
        Validate(request);
        try
        {
            return await transactionExecutor.ExecuteAsync(async cancellationToken =>
            {
                var booking = await db.Bookings.SingleOrDefaultAsync(x => x.BookingId == bookingId, cancellationToken)
                    ?? throw new ResourceNotFoundException("booking_not_found", "Không tìm thấy booking để ghi nhận thanh toán.");
                if (booking.Status is "CHECKED_OUT" or "CANCELLED" or "NO_SHOW")
                    throw new BusinessRuleException("booking_is_closed", "Booking đã kết thúc hoặc đã hủy nên không thể ghi nhận thêm thanh toán.");

                var alreadyRecorded = await db.Payments
                    .Where(x => x.BookingId == bookingId)
                    .SumAsync(x => (decimal?)x.Amount, cancellationToken) ?? 0;
                var remainingAmount = booking.PreviousDebt + booking.GrossRevenue - booking.DebtAmount - alreadyRecorded;
                if (request.Amount > remainingAmount)
                    throw new BusinessRuleException(
                        "payment_exceeds_balance",
                        $"Số tiền ghi nhận vượt quá số cần thu còn lại ({Math.Max(remainingAmount, 0):N0} đ).");

                var payment = new Payment
                {
                    BookingId = bookingId,
                    Amount = request.Amount,
                    Method = request.Method.Trim().ToUpperInvariant(),
                    PaidAt = request.PaidAt ?? HotelClock.Now(),
                    ReferenceCode = Clean(request.ReferenceCode),
                    Note = Clean(request.Note)
                };
                db.Payments.Add(payment);
                await db.SaveChangesAsync(cancellationToken);
                await SyncLegacyTotalsAsync(booking, cancellationToken);
                await db.SaveChangesAsync(cancellationToken);
                var invoiceResult = await invoiceLifecycle.EnsureAsync(booking, issue: false, cancellationToken);
                auditWriter.Add("CREATE", "Payment", payment.PaymentId.ToString(), new
                {
                    payment.BookingId,
                    payment.Amount,
                    payment.Method,
                    payment.PaidAt,
                    payment.ReferenceCode
                });
                auditWriter.Add(
                    invoiceResult.Created ? "CREATE" : "SYNC",
                    "Invoice",
                    invoiceResult.Invoice.InvoiceId > 0
                        ? invoiceResult.Invoice.InvoiceId.ToString()
                        : $"booking:{booking.BookingId}",
                    new
                    {
                        invoiceResult.Invoice.InvoiceNumber,
                        invoiceResult.Invoice.BookingId,
                        invoiceResult.Invoice.GrossAmount,
                        invoiceResult.Invoice.PaidAmount
                    });
                await db.SaveChangesAsync(cancellationToken);
                return ToItem(payment);
            }, token);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("payment_changed", "Sổ thu tiền vừa thay đổi. Vui lòng tải lại trước khi ghi nhận thêm khoản thu.");
        }
    }

    public async Task<IReadOnlyList<PaymentItem>> RefundDepositAsync(long bookingId, CancellationToken token) =>
        await transactionExecutor.ExecuteAsync(async cancellationToken =>
        {
            var booking = await db.Bookings.Include(x => x.Invoice)
                .SingleOrDefaultAsync(x => x.BookingId == bookingId, cancellationToken)
                ?? throw new ResourceNotFoundException("booking_not_found", "Không tìm thấy booking để hoàn cọc.");
            if (booking.Status is not ("CANCELLED" or "NO_SHOW"))
                throw new BusinessRuleException("refund_requires_cancelled_booking", "Chỉ ghi nhận hoàn cọc cho booking đã hủy hoặc khách không đến.");

            var totals = await db.Payments.AsNoTracking().Where(x => x.BookingId == bookingId)
                .GroupBy(x => x.Method)
                .Select(group => new { Method = group.Key, Amount = group.Sum(x => x.Amount) })
                .ToListAsync(cancellationToken);
            if (totals.Any(x => x.Amount < 0))
                throw new BusinessRuleException("invalid_refund_balance", "Sổ thu tiền có số dư âm; cần kiểm tra lại trước khi hoàn cọc.");
            var refundable = totals.Where(x => x.Amount > 0).ToList();
            if (refundable.Count == 0)
                throw new BusinessRuleException("deposit_already_refunded", "Booking không còn tiền cọc cần hoàn.");

            var now = HotelClock.Now();
            var refunds = refundable.Select(x => new Payment
            {
                BookingId = bookingId,
                Amount = -x.Amount,
                Method = x.Method,
                PaidAt = now,
                Note = "Đã hoàn cọc cho khách (ghi nhận nội bộ)"
            }).ToList();
            db.Payments.AddRange(refunds);
            await db.SaveChangesAsync(cancellationToken);
            await SyncLegacyTotalsAsync(booking, cancellationToken);
            if (booking.Invoice is not null)
            {
                booking.Invoice.PaidAmount = 0;
                booking.Invoice.BalanceDue = 0;
            }
            foreach (var refund in refunds)
                auditWriter.Add("REFUND", "Payment", refund.PaymentId.ToString(), new
                {
                    refund.BookingId, refund.Amount, refund.Method, refund.PaidAt
                });
            try { await db.SaveChangesAsync(cancellationToken); }
            catch (DbUpdateConcurrencyException)
            {
                throw new ConflictException("refund_changed", "Sổ thu tiền vừa thay đổi. Vui lòng tải lại trước khi ghi nhận hoàn cọc.");
            }
            return (IReadOnlyList<PaymentItem>)refunds.Select(ToItem).ToList();
        }, token);

    private async Task SyncLegacyTotalsAsync(Booking booking, CancellationToken token)
    {
        var totals = await db.Payments.AsNoTracking()
            .Where(x => x.BookingId == booking.BookingId)
            .GroupBy(x => x.Method)
            .Select(group => new { Method = group.Key, Amount = group.Sum(x => x.Amount) })
            .ToDictionaryAsync(x => x.Method, x => x.Amount, token);
        booking.CashAmount = totals.GetValueOrDefault("CASH");
        booking.CardAmount = totals.GetValueOrDefault("CARD");
        booking.TransferAmount = totals.GetValueOrDefault("TRANSFER");
    }

    private static void Validate(PaymentWriteRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        var method = request.Method?.Trim().ToUpperInvariant();
        if (request.Amount <= 0) errors["amount"] = ["Số tiền thanh toán phải lớn hơn 0."];
        else if (decimal.Round(request.Amount, 2) != request.Amount)
            errors["amount"] = ["Số tiền chỉ được có tối đa hai chữ số thập phân."];
        if (!Methods.Contains(method)) errors["method"] = ["Phương thức thanh toán không hợp lệ."];
        if (request.PaidAt?.Kind is not null and not DateTimeKind.Unspecified)
            errors["paidAt"] = ["Ngày giờ thu tiền phải theo giờ khách sạn, không kèm múi giờ."];
        if (request.PaidAt > HotelClock.Now().AddMinutes(1))
            errors["paidAt"] = ["Thời điểm thu tiền không được ở tương lai."];
        if (request.ReferenceCode?.Trim().Length > 100) errors["referenceCode"] = ["Mã giao dịch tối đa 100 ký tự."];
        if (request.Note?.Trim().Length > 300) errors["note"] = ["Ghi chú tối đa 300 ký tự."];
        if (errors.Count > 0) throw new RequestValidationException(errors);
    }

    private static PaymentItem ToItem(Payment x) => new(
        x.PaymentId,
        x.BookingId,
        x.Amount,
        x.Method,
        x.PaidAt,
        x.ReferenceCode,
        x.Note,
        Convert.ToBase64String(x.Version));

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
