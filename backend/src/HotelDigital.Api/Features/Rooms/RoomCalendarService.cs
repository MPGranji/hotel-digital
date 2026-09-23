using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Features.Rooms;

public sealed class RoomCalendarService(
    HotelDbContext db,
    IAuditWriter auditWriter,
    ITransactionExecutor transactionExecutor)
{
    public async Task<RoomCalendarResponse> GetAsync(DateOnly dateFrom, int days, CancellationToken token)
    {
        days = Math.Clamp(days, 1, 31);
        var dateTo = dateFrom.AddDays(days);
        var start = dateFrom.ToDateTime(TimeOnly.MinValue);
        var end = dateTo.ToDateTime(TimeOnly.MinValue);
        var dates = Enumerable.Range(0, days).Select(dateFrom.AddDays).ToList();
        var rooms = await db.Rooms.AsNoTracking().Where(x => x.CountsTowardOccupancy)
            .OrderBy(x => x.RoomNumber).Select(x => new
            {
                x.RoomId, x.RoomNumber, RoomTypeName = x.RoomType.Name, x.FloorLabel, x.IsActive
            }).ToListAsync(token);
        var bookings = await db.Bookings.AsNoTracking()
            .Where(x => (x.Status == "BOOKED" || x.Status == "CHECKED_IN" || x.Status == "CHECKED_OUT") && x.CheckInAt < end && x.CheckOutAt > start)
            .Select(x => new { x.BookingId, x.BookingCode, x.RoomId, x.CheckInAt, x.CheckOutAt, x.Status, x.Customer.FullName })
            .ToListAsync(token);
        bookings = bookings
            .OrderBy(x => x.Status == "CHECKED_IN" ? 0 : x.Status == "BOOKED" ? 1 : 2)
            .ThenBy(x => x.CheckInAt)
            .ToList();
        var blocks = await db.RoomBlocks.AsNoTracking()
            .Where(x => x.IsActive && x.StartAt < end && x.EndAt > start)
            .Select(x => new { x.RoomBlockId, x.RoomId, x.StartAt, x.EndAt, x.Reason })
            .ToListAsync(token);

        var rows = rooms.Select(room => new RoomCalendarRow(
            room.RoomId,
            room.RoomNumber,
            room.RoomTypeName,
            room.FloorLabel,
            dates.Select(date =>
            {
                var dayStart = date.ToDateTime(TimeOnly.MinValue);
                var dayEnd = dayStart.AddDays(1);
                if (!room.IsActive) return new RoomCalendarCell(date, "INACTIVE", null, null, null, null, null);
                var block = blocks.FirstOrDefault(x => x.RoomId == room.RoomId && x.StartAt < dayEnd && x.EndAt > dayStart);
                if (block is not null) return new RoomCalendarCell(date, "MAINTENANCE", null, null, null, block.RoomBlockId, block.Reason);
                var booking = bookings.FirstOrDefault(x => x.RoomId == room.RoomId && x.CheckInAt < dayEnd && x.CheckOutAt > dayStart);
                if (booking is not null) return new RoomCalendarCell(date, booking.Status, booking.BookingId, booking.BookingCode, booking.FullName, null, null);
                return new RoomCalendarCell(date, "AVAILABLE", null, null, null, null, null);
            }).ToList())).ToList();
        return new RoomCalendarResponse(dateFrom, dateTo, dates, rows);
    }

    public async Task<RoomHourlyCalendarResponse> GetHourlyAsync(int roomId, DateOnly weekStart, CancellationToken token)
    {
        var normalizedWeekStart = weekStart.AddDays(-(((int)weekStart.DayOfWeek + 6) % 7));
        var weekEnd = normalizedWeekStart.AddDays(7);
        var start = normalizedWeekStart.ToDateTime(TimeOnly.MinValue);
        var end = weekEnd.ToDateTime(TimeOnly.MinValue);
        var room = await db.Rooms.AsNoTracking()
            .Where(x => x.RoomId == roomId && x.CountsTowardOccupancy)
            .Select(x => new { x.RoomId, x.RoomNumber, RoomTypeName = x.RoomType.Name, x.FloorLabel, x.IsActive })
            .SingleOrDefaultAsync(token)
            ?? throw new ResourceNotFoundException("room_not_found", "Không tìm thấy phòng.");

        var bookings = await db.Bookings.AsNoTracking()
            .Where(x => x.RoomId == roomId && (x.Status == "BOOKED" || x.Status == "CHECKED_IN" || x.Status == "CHECKED_OUT") && x.CheckInAt < end && x.CheckOutAt > start)
            .OrderBy(x => x.CheckInAt)
            .Select(x => new RoomHourlyCalendarEvent(
                "BOOKING", x.Status, x.CheckInAt, x.CheckOutAt,
                x.BookingId, x.BookingCode, x.Customer.FullName, null, null))
            .ToListAsync(token);
        var blocks = await db.RoomBlocks.AsNoTracking()
            .Where(x => x.RoomId == roomId && x.IsActive && x.StartAt < end && x.EndAt > start)
            .OrderBy(x => x.StartAt)
            .Select(x => new RoomHourlyCalendarEvent(
                "MAINTENANCE", "MAINTENANCE", x.StartAt, x.EndAt,
                null, null, null, x.RoomBlockId, x.Reason))
            .ToListAsync(token);
        var events = bookings.Concat(blocks).OrderBy(x => x.StartAt).ToList();
        var dates = Enumerable.Range(0, 7).Select(normalizedWeekStart.AddDays).ToList();
        return new RoomHourlyCalendarResponse(
            normalizedWeekStart, weekEnd.AddDays(-1), room.RoomId, room.RoomNumber,
            room.RoomTypeName, room.FloorLabel, room.IsActive, dates, events);
    }

    public async Task<RoomBlockItem> GetBlockAsync(long id, CancellationToken token)
    {
        var block = await db.RoomBlocks.AsNoTracking().Include(x => x.Room).SingleOrDefaultAsync(x => x.RoomBlockId == id, token)
            ?? throw new ResourceNotFoundException("room_block_not_found", "Không tìm thấy lịch bảo trì.");
        return ToItem(block);
    }

    public async Task<RoomBlockItem> CreateBlockAsync(RoomBlockWriteRequest request, CancellationToken token)
    {
        Validate(request, false);
        return await transactionExecutor.ExecuteAsync(async ct =>
        {
            await EnsureAvailableForBlockAsync(request, null, ct);
            var block = new RoomBlock();
            Apply(block, request);
            db.RoomBlocks.Add(block);
            await SaveAsync(ct);
            auditWriter.Add("CREATE", "RoomBlock", block.RoomBlockId.ToString(), new { block.RoomId, block.StartAt, block.EndAt, block.Reason });
            await db.SaveChangesAsync(ct);
            return await GetBlockAsync(block.RoomBlockId, ct);
        }, token);
    }

    public async Task<RoomBlockItem> UpdateBlockAsync(long id, RoomBlockWriteRequest request, CancellationToken token)
    {
        Validate(request, true);
        if (!TryDecodeVersion(request.Version, out var version))
            throw new RequestValidationException(new Dictionary<string, string[]> { ["version"] = ["Phiên bản lịch bảo trì không hợp lệ."] });
        return await transactionExecutor.ExecuteAsync(async ct =>
        {
            var block = await db.RoomBlocks.SingleOrDefaultAsync(x => x.RoomBlockId == id, ct)
                ?? throw new ResourceNotFoundException("room_block_not_found", "Không tìm thấy lịch bảo trì.");
            db.Entry(block).Property(x => x.Version).OriginalValue = version;
            if (request.IsActive) await EnsureAvailableForBlockAsync(request, id, ct);
            Apply(block, request);
            auditWriter.Add(request.IsActive ? "UPDATE" : "CANCEL", "RoomBlock", id.ToString(), new { block.RoomId, block.StartAt, block.EndAt, block.Reason });
            try { await SaveAsync(ct); }
            catch (DbUpdateConcurrencyException) { throw new ConflictException("room_block_version_conflict", "Lịch bảo trì đã được cập nhật. Vui lòng tải lại."); }
            return await GetBlockAsync(id, ct);
        }, token);
    }

    private async Task EnsureAvailableForBlockAsync(RoomBlockWriteRequest request, long? excludeId, CancellationToken token)
    {
        if (!await db.Rooms.AsNoTracking().AnyAsync(x => x.RoomId == request.RoomId && x.IsActive, token))
            throw new BusinessRuleException("room_unavailable", "Phòng không tồn tại hoặc đã ngừng hoạt động.");
        if (await db.Bookings.AsNoTracking().AnyAsync(x => x.RoomId == request.RoomId && x.Status != "CANCELLED" && x.Status != "NO_SHOW" && x.CheckInAt < request.EndAt && x.CheckOutAt > request.StartAt, token))
            throw new BusinessRuleException("maintenance_booking_conflict", "Phòng đã có booking trong thời gian bảo trì.");
        if (await db.RoomBlocks.AsNoTracking().AnyAsync(x => x.RoomId == request.RoomId && x.RoomBlockId != excludeId && x.IsActive && x.StartAt < request.EndAt && x.EndAt > request.StartAt, token))
            throw new BusinessRuleException("maintenance_time_conflict", "Phòng đã có lịch bảo trì trong thời gian này.");
    }

    private static void Validate(RoomBlockWriteRequest request, bool requireVersion)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.RoomId <= 0) errors["roomId"] = ["Vui lòng chọn phòng."];
        if (request.EndAt <= request.StartAt) errors["endAt"] = ["Thời gian kết thúc phải sau thời gian bắt đầu."];
        if (string.IsNullOrWhiteSpace(request.Reason)) errors["reason"] = ["Vui lòng nhập lý do bảo trì."];
        else if (request.Reason.Trim().Length > 120) errors["reason"] = ["Lý do tối đa 120 ký tự."];
        if (request.Note?.Trim().Length > 500) errors["note"] = ["Ghi chú tối đa 500 ký tự."];
        if (requireVersion && !TryDecodeVersion(request.Version, out _)) errors["version"] = ["Phiên bản lịch bảo trì không hợp lệ."];
        if (errors.Count > 0) throw new RequestValidationException(errors);
    }

    private static void Apply(RoomBlock block, RoomBlockWriteRequest request)
    {
        block.RoomId = request.RoomId;
        block.StartAt = request.StartAt;
        block.EndAt = request.EndAt;
        block.Reason = request.Reason.Trim();
        block.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        block.IsActive = request.IsActive;
    }

    private static RoomBlockItem ToItem(RoomBlock x) => new(x.RoomBlockId, x.RoomId, x.Room.RoomNumber, x.StartAt, x.EndAt, x.Reason, x.Note, x.IsActive, Convert.ToBase64String(x.Version));

    private async Task SaveAsync(CancellationToken token)
    {
        try { await db.SaveChangesAsync(token); }
        catch (DbUpdateException exception) when (FindSqlException(exception)?.Number == 51005)
        { throw new BusinessRuleException("maintenance_booking_conflict", "Phòng vừa có booking trong thời gian bảo trì."); }
        catch (DbUpdateException exception) when (FindSqlException(exception)?.Number == 51006)
        { throw new BusinessRuleException("maintenance_time_conflict", "Phòng vừa có lịch bảo trì trong thời gian này."); }
    }

    private static SqlException? FindSqlException(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
            if (current is SqlException sqlException) return sqlException;
        return null;
    }

    private static bool TryDecodeVersion(string? value, out byte[] version)
    {
        version = [];
        try { if (string.IsNullOrWhiteSpace(value)) return false; version = Convert.FromBase64String(value); return version.Length == 8; }
        catch (FormatException) { return false; }
    }
}
