using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Features.Bookings;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Features.Rooms;

public sealed class RoomService(
    HotelDbContext db,
    IAuditWriter auditWriter,
    ITransactionExecutor transactionExecutor)
{
    public async Task<IReadOnlyList<RoomListItem>> GetAsync(string? search, string? status, CancellationToken cancellationToken)
    {
        var now = GetHotelNow();
        var query = db.Rooms.AsNoTracking().Select(room => new
        {
            room.RoomId,
            room.RoomNumber,
            room.RoomTypeId,
            RoomTypeCode = room.RoomType.Code,
            RoomTypeName = room.RoomType.Name,
            room.RoomType.Capacity,
            room.FloorLabel,
            room.RoomType.ListedPricePerNight,
            room.IsActive,
            room.CountsTowardOccupancy,
            room.Note,
            BookingCount = room.Bookings.Count,
            IsUnderMaintenance = room.Blocks.Any(block => block.IsActive && block.StartAt <= now && block.EndAt > now),
            Current = room.Bookings
                .Where(booking => booking.Status == "CHECKED_IN" || (booking.Status == "BOOKED" && booking.CheckInAt <= now && booking.CheckOutAt > now))
                .OrderBy(booking => booking.Status == "CHECKED_IN" ? 0 : 1)
                .ThenBy(booking => booking.CheckInAt)
                .Select(booking => new
                {
                    booking.BookingId,
                    booking.BookingCode,
                    booking.Status,
                    booking.Customer.FullName,
                    booking.Customer.Phone
                })
                .FirstOrDefault(),
            NextCheckInAt = room.Bookings.Where(booking => booking.Status == "BOOKED" && booking.CheckInAt > now).Min(booking => (DateTime?)booking.CheckInAt)
        });

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => x.RoomNumber.Contains(term) || x.RoomTypeName.Contains(term) || x.RoomTypeCode.Contains(term) || (x.FloorLabel != null && x.FloorLabel.Contains(term)));
        }

        var rows = await query.OrderBy(x => x.RoomNumber).ToListAsync(cancellationToken);
        var result = rows.Select(x => new RoomListItem(
            x.RoomId, x.RoomNumber, x.RoomTypeId, x.RoomTypeCode, x.RoomTypeName, x.Capacity, x.FloorLabel,
            x.ListedPricePerNight ?? PhamNguLaoRateCatalog.GetListedPrice(x.RoomTypeCode), x.IsActive,
            x.CountsTowardOccupancy, x.Note, x.BookingCount, GetStatus(x.IsActive, x.IsUnderMaintenance, x.Current?.Status),
            x.Current?.BookingId, x.Current?.BookingCode, x.Current?.FullName, x.Current?.Phone, x.NextCheckInAt));

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToUpperInvariant();
            result = result.Where(x => x.Status == normalizedStatus);
        }
        return result.ToList();
    }

    public async Task<RoomListItem> CreateRoomAsync(RoomWriteRequest request, CancellationToken cancellationToken)
    {
        RoomValidator.Validate(request);
        return await transactionExecutor.ExecuteAsync(async token =>
        {
            var roomNumber = request.RoomNumber.Trim().ToUpperInvariant();
            await EnsureRoomNumberUniqueAsync(roomNumber, null, token);
            await EnsureRoomTypeExistsAsync(request.RoomTypeId, token);
            var room = new Room
            {
                RoomNumber = roomNumber,
                RoomTypeId = request.RoomTypeId,
                FloorLabel = Clean(request.FloorLabel),
                IsActive = request.IsActive,
                CountsTowardOccupancy = request.CountsTowardOccupancy,
                Note = Clean(request.Note)
            };
            db.Rooms.Add(room);
            await SaveAsync("room_number_exists", "Số phòng đã được sử dụng.", token);
            auditWriter.Add("CREATE", "Room", room.RoomId.ToString(), new { room.RoomNumber, room.RoomTypeId, room.IsActive });
            await db.SaveChangesAsync(token);
            return await GetRoomAsync(room.RoomId, token);
        }, cancellationToken);
    }

    public async Task<RoomListItem> UpdateRoomAsync(int id, RoomWriteRequest request, CancellationToken cancellationToken)
    {
        RoomValidator.Validate(request);
        return await transactionExecutor.ExecuteAsync(async token =>
        {
            var room = await db.Rooms.SingleOrDefaultAsync(x => x.RoomId == id, token)
                ?? throw new ResourceNotFoundException("room_not_found", "Không tìm thấy phòng.");
            if (room.IsActive && !request.IsActive)
            {
                var now = GetHotelNow();
                var hasOpenBooking = await db.Bookings.AsNoTracking().AnyAsync(x =>
                    x.RoomId == id
                    && (x.Status == "BOOKED" || x.Status == "CHECKED_IN")
                    && x.CheckOutAt > now,
                    token);
                if (hasOpenBooking)
                    throw new BusinessRuleException(
                        "room_has_open_booking",
                        "Không thể ngừng phòng đang có khách hoặc còn booking sắp tới.");
            }
            var roomNumber = request.RoomNumber.Trim().ToUpperInvariant();
            await EnsureRoomNumberUniqueAsync(roomNumber, id, token);
            await EnsureRoomTypeExistsAsync(request.RoomTypeId, token);
            var changedFields = new List<string>();
            Track(changedFields, "RoomNumber", room.RoomNumber, roomNumber);
            Track(changedFields, "RoomTypeId", room.RoomTypeId, request.RoomTypeId);
            Track(changedFields, "FloorLabel", room.FloorLabel, Clean(request.FloorLabel));
            Track(changedFields, "IsActive", room.IsActive, request.IsActive);
            Track(changedFields, "CountsTowardOccupancy", room.CountsTowardOccupancy, request.CountsTowardOccupancy);
            Track(changedFields, "Note", room.Note, Clean(request.Note));
            room.RoomNumber = roomNumber;
            room.RoomTypeId = request.RoomTypeId;
            room.FloorLabel = Clean(request.FloorLabel);
            room.IsActive = request.IsActive;
            room.CountsTowardOccupancy = request.CountsTowardOccupancy;
            room.Note = Clean(request.Note);
            auditWriter.Add("UPDATE", "Room", id.ToString(), new { fields = changedFields });
            await SaveAsync("room_number_exists", "Số phòng đã được sử dụng.", token);
            return await GetRoomAsync(id, token);
        }, cancellationToken);
    }

    public async Task<IReadOnlyList<RoomTypeItem>> GetRoomTypesAsync(bool? isActive, CancellationToken cancellationToken)
    {
        var query = db.RoomTypes.AsNoTracking();
        if (isActive.HasValue) query = query.Where(x => x.IsActive == isActive.Value);
        return await query.OrderBy(x => x.Code).Select(x => new RoomTypeItem(
            x.RoomTypeId, x.Code, x.Name, x.Capacity,
            x.ListedPricePerNight ?? PhamNguLaoRateCatalog.GetListedPrice(x.Code), x.IsActive, x.Rooms.Count)).ToListAsync(cancellationToken);
    }

    public Task<RoomTypeItem> CreateRoomTypeAsync(RoomTypeWriteRequest request, CancellationToken cancellationToken) =>
        SaveRoomTypeAsync(null, request, cancellationToken);

    public Task<RoomTypeItem> UpdateRoomTypeAsync(int id, RoomTypeWriteRequest request, CancellationToken cancellationToken) =>
        SaveRoomTypeAsync(id, request, cancellationToken);

    private async Task<RoomTypeItem> SaveRoomTypeAsync(int? id, RoomTypeWriteRequest request, CancellationToken cancellationToken)
    {
        RoomValidator.Validate(request);
        return await transactionExecutor.ExecuteAsync(async token =>
        {
            var code = request.Code.Trim().ToUpperInvariant();
            if (await db.RoomTypes.AsNoTracking().AnyAsync(x => x.Code == code && x.RoomTypeId != id, token))
                throw new ConflictException("room_type_code_exists", "Mã hạng phòng đã được sử dụng.");
            RoomType roomType;
            var action = "CREATE";
            if (id.HasValue)
            {
                roomType = await db.RoomTypes.SingleOrDefaultAsync(x => x.RoomTypeId == id.Value, token)
                    ?? throw new ResourceNotFoundException("room_type_not_found", "Không tìm thấy hạng phòng.");
                action = "UPDATE";
            }
            else
            {
                roomType = new RoomType();
                db.RoomTypes.Add(roomType);
            }
            roomType.Code = code;
            roomType.Name = request.Name.Trim();
            roomType.Capacity = request.Capacity;
            roomType.ListedPricePerNight = request.ListedPricePerNight;
            roomType.IsActive = request.IsActive;
            await SaveAsync("room_type_code_exists", "Mã hạng phòng đã được sử dụng.", token);
            auditWriter.Add(action, "RoomType", roomType.RoomTypeId.ToString(), new { roomType.Code, roomType.Name, roomType.Capacity, roomType.ListedPricePerNight, roomType.IsActive });
            await db.SaveChangesAsync(token);
            var roomCount = await db.Rooms.CountAsync(x => x.RoomTypeId == roomType.RoomTypeId, token);
            return new RoomTypeItem(roomType.RoomTypeId, roomType.Code, roomType.Name, roomType.Capacity, roomType.ListedPricePerNight, roomType.IsActive, roomCount);
        }, cancellationToken);
    }

    private async Task<RoomListItem> GetRoomAsync(int id, CancellationToken cancellationToken) =>
        (await GetAsync(null, null, cancellationToken)).Single(x => x.Id == id);

    private async Task EnsureRoomNumberUniqueAsync(string roomNumber, int? excludeId, CancellationToken token)
    {
        if (await db.Rooms.AsNoTracking().AnyAsync(x => x.RoomNumber == roomNumber && x.RoomId != excludeId, token))
            throw new ConflictException("room_number_exists", "Số phòng đã được sử dụng.");
    }

    private async Task EnsureRoomTypeExistsAsync(int roomTypeId, CancellationToken token)
    {
        if (!await db.RoomTypes.AsNoTracking().AnyAsync(x => x.RoomTypeId == roomTypeId, token))
            throw new ResourceNotFoundException("room_type_not_found", "Không tìm thấy hạng phòng.");
    }

    private async Task SaveAsync(string code, string message, CancellationToken token)
    {
        try { await db.SaveChangesAsync(token); }
        catch (DbUpdateException exception) when (FindSqlException(exception)?.Number is 2601 or 2627)
        { throw new ConflictException(code, message); }
    }

    private static SqlException? FindSqlException(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
            if (current is SqlException sqlException) return sqlException;
        return null;
    }

    private static void Track<T>(List<string> fields, string field, T before, T after)
    {
        if (!EqualityComparer<T>.Default.Equals(before, after)) fields.Add(field);
    }

    private static string GetStatus(bool isActive, bool isUnderMaintenance, string? bookingStatus) => (isActive, isUnderMaintenance, bookingStatus) switch
    {
        (false, _, _) => "INACTIVE",
        (true, true, _) => "MAINTENANCE",
        (true, false, "CHECKED_IN") => "OCCUPIED",
        (true, false, "BOOKED") => "RESERVED",
        _ => "AVAILABLE"
    };

    private static DateTime GetHotelNow()
    {
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, timeZone);
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
