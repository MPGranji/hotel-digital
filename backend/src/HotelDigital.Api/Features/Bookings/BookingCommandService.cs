using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Features.Bookings;

public sealed class BookingCommandService(
    HotelDbContext db,
    IAuditWriter auditWriter,
    ITransactionExecutor transactionExecutor)
{
    public async Task<long> CreateAsync(
        BookingWriteRequest request,
        CancellationToken cancellationToken)
    {
        BookingValidator.Validate(request, requireVersion: false);

        return await transactionExecutor.ExecuteAsync(async token =>
        {
            await EnsureReferencesAsync(request, token);
            await EnsureRoomAvailableAsync(request.RoomId, request.CheckInAt, request.CheckOutAt, null, token);
            var booking = new Booking();
            AssignCustomer(booking, request);
            BookingMutation.Apply(booking, request);
            db.Bookings.Add(booking);

            await SaveWithBusinessErrorsAsync(token);
            if (booking.CustomerId > 0 && request.NewCustomer is not null)
            {
                auditWriter.Add("CREATE", "Customer", booking.CustomerId.ToString(), new
                {
                    fields = new[] { "FullName", "Phone", "Email", "IdentityDocument", "Nationality", "Note" }
                });
            }
            auditWriter.Add("CREATE", "Booking", booking.BookingId.ToString(), new
            {
                booking.RoomId,
                booking.CustomerId,
                booking.ChannelId,
                booking.CheckInAt,
                booking.CheckOutAt,
                booking.BilledNights,
                booking.Status
            });
            await db.SaveChangesAsync(token);
            return booking.BookingId;
        }, cancellationToken);
    }

    public async Task UpdateAsync(
        long id,
        BookingWriteRequest request,
        CancellationToken cancellationToken)
    {
        BookingValidator.Validate(request, requireVersion: true);
        var version = BookingValidator.DecodeVersion(request.Version!);

        await transactionExecutor.ExecuteAsync(async token =>
        {
            var booking = await db.Bookings.SingleOrDefaultAsync(x => x.BookingId == id, token)
                ?? throw new ResourceNotFoundException("booking_not_found", "Không tìm thấy đặt phòng.");
            if (booking.Status is "CHECKED_OUT" or "CANCELLED" or "NO_SHOW")
                throw new BusinessRuleException(
                    "booking_is_closed",
                    "Đặt phòng đã kết thúc hoặc đã hủy nên không thể sửa nội dung.");

            db.Entry(booking).Property(x => x.Version).OriginalValue = version;
            await EnsureReferencesAsync(request, token);
            await EnsureRoomAvailableAsync(request.RoomId, request.CheckInAt, request.CheckOutAt, id, token);
            var changedFields = BookingMutation.GetChangedFields(booking, request);
            AssignCustomer(booking, request);
            BookingMutation.Apply(booking, request);
            auditWriter.Add("UPDATE", "Booking", booking.BookingId.ToString(), new { fields = changedFields });

            try
            {
                await SaveWithBusinessErrorsAsync(token);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new ConflictException(
                    "booking_version_conflict",
                    "Đặt phòng đã được người khác cập nhật. Vui lòng tải lại trước khi lưu.");
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
            var booking = await db.Bookings.SingleOrDefaultAsync(x => x.BookingId == id, token)
                ?? throw new ResourceNotFoundException("booking_not_found", "Không tìm thấy đặt phòng.");
            db.Entry(booking).Property(x => x.Version).OriginalValue = version;
            BookingMutation.EnsureTransition(booking.Status, targetStatus);
            var previousStatus = booking.Status;
            booking.Status = targetStatus;
            auditWriter.Add("STATUS_CHANGE", "Booking", booking.BookingId.ToString(), new
            {
                from = previousStatus,
                to = targetStatus
            });

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

    private async Task EnsureReferencesAsync(BookingWriteRequest request, CancellationToken cancellationToken)
    {
        var roomIsActive = await db.Rooms.AsNoTracking()
            .AnyAsync(x => x.RoomId == request.RoomId && x.IsActive, cancellationToken);
        if (!roomIsActive)
            throw new BusinessRuleException("room_unavailable", "Phòng không tồn tại hoặc đã ngừng hoạt động.");

        var channelIsActive = await db.Channels.AsNoTracking()
            .AnyAsync(x => x.ChannelId == request.ChannelId && x.IsActive, cancellationToken);
        if (!channelIsActive)
            throw new BusinessRuleException("channel_inactive", "Kênh đặt phòng không tồn tại hoặc đã ngừng hoạt động.");

        if (request.CustomerId.HasValue
            && !await db.Customers.AsNoTracking().AnyAsync(x => x.CustomerId == request.CustomerId, cancellationToken))
        {
            throw new BusinessRuleException("customer_not_found", "Khách hàng đã chọn không còn tồn tại.");
        }
    }

    private async Task EnsureRoomAvailableAsync(
        int roomId,
        DateTime checkInAt,
        DateTime checkOutAt,
        long? excludeBookingId,
        CancellationToken cancellationToken)
    {
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
    }

    private static SqlException? FindSqlException(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
            if (current is SqlException sqlException) return sqlException;
        return null;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
