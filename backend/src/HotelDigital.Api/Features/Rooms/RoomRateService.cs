using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Authentication;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Features.Rooms;

public sealed class RoomRateService(
    HotelDbContext db,
    IAuditWriter auditWriter,
    ICurrentUser currentUser,
    ITransactionExecutor transactionExecutor)
{
    public async Task<IReadOnlyList<RoomRateItem>> GetAsync(int? roomTypeId, bool? isActive, CancellationToken token)
    {
        var query = db.RoomRates.AsNoTracking().Include(x => x.RoomType).Where(x => x.RateCode == "NET");
        if (roomTypeId.HasValue) query = query.Where(x => x.RoomTypeId == roomTypeId.Value);
        if (isActive.HasValue) query = query.Where(x => x.IsActive == isActive.Value);
        return (await query.OrderBy(x => x.RoomType.Code).ThenBy(x => x.RateCode).ThenByDescending(x => x.EffectiveFrom).ToListAsync(token))
            .Select(ToItem).ToList();
    }

    public async Task<RoomRateItem> GetOneAsync(long id, CancellationToken token)
    {
        var rate = await db.RoomRates.AsNoTracking().Include(x => x.RoomType)
            .SingleOrDefaultAsync(x => x.RoomRateId == id, token)
            ?? throw new ResourceNotFoundException("room_rate_not_found", "Không tìm thấy cấu hình giá phòng.");
        return ToItem(rate);
    }

    public async Task<IReadOnlyList<RoomRateHistoryItem>> GetHistoryAsync(long id, CancellationToken token)
    {
        if (!await db.RoomRates.AsNoTracking().AnyAsync(x => x.RoomRateId == id, token))
            throw new ResourceNotFoundException("room_rate_not_found", "Không tìm thấy cấu hình giá phòng.");

        var rows = await db.RoomRates.TemporalAll()
            .Where(x => x.RoomRateId == id)
            .OrderByDescending(x => EF.Property<DateTime>(x, "ValidFromUtc"))
            .Select(x => new RoomRateHistoryRow(
                x.RoomRateId, x.EffectiveFrom, x.EffectiveTo,
                x.MondayPrice, x.TuesdayPrice, x.WednesdayPrice, x.ThursdayPrice,
                x.FridayPrice, x.SaturdayPrice, x.SundayPrice, x.IsActive, x.Note,
                EF.Property<DateTime>(x, "ValidFromUtc"),
                EF.Property<DateTime>(x, "ValidToUtc"),
                x.LastModifiedAtUtc, x.LastModifiedByDisplayName))
            .ToListAsync(token);

        return rows.Select(x => new RoomRateHistoryItem(
            x.Id, x.EffectiveFrom, x.EffectiveTo,
            x.MondayPrice, x.TuesdayPrice, x.WednesdayPrice, x.ThursdayPrice,
            x.FridayPrice, x.SaturdayPrice, x.SundayPrice, x.IsActive, x.Note,
            x.RecordedFromUtc, x.RecordedToUtc, x.RecordedToUtc == DateTime.MaxValue,
            x.LastModifiedAtUtc, x.LastModifiedByDisplayName)).ToList();
    }

    public async Task<RoomRateItem> CreateAsync(RoomRateWriteRequest request, CancellationToken token)
    {
        Validate(request, false);
        return await transactionExecutor.ExecuteAsync(async ct =>
        {
            await EnsureRoomTypeAsync(request.RoomTypeId, ct);
            await LockRoomTypeRatesAsync(request.RoomTypeId, ct);
            if (request.IsActive && request.EffectiveTo is null)
            {
                var closedCurrentRate = await CloseCurrentOpenRateAsync(request, ct);
                if (closedCurrentRate)
                {
                    try { await SaveAsync(ct); }
                    catch (DbUpdateConcurrencyException) { throw new ConflictException("room_rate_version_conflict", "Bảng giá vừa thay đổi. Vui lòng tải lại."); }
                }
            }
            if (request.IsActive) await EnsureNoOverlapAsync(request, null, ct);
            var rate = new RoomRate();
            Apply(rate, request);
            db.RoomRates.Add(rate);
            try { await SaveAsync(ct); }
            catch (DbUpdateConcurrencyException) { throw new ConflictException("room_rate_version_conflict", "Bảng giá vừa thay đổi. Vui lòng tải lại."); }
            auditWriter.Add("CREATE", "RoomRate", rate.RoomRateId.ToString(), new { after = Snapshot(rate) });
            await db.SaveChangesAsync(ct);
            return await GetOneAsync(rate.RoomRateId, ct);
        }, token);
    }

    public async Task<RoomRateItem> UpdateAsync(long id, RoomRateWriteRequest request, CancellationToken token)
    {
        Validate(request, true);
        if (!TryDecodeVersion(request.Version, out var version))
            throw new RequestValidationException(new Dictionary<string, string[]> { ["version"] = ["Phiên bản bảng giá không hợp lệ."] });

        return await transactionExecutor.ExecuteAsync(async ct =>
        {
            var rate = await db.RoomRates.SingleOrDefaultAsync(x => x.RoomRateId == id, ct)
                ?? throw new ResourceNotFoundException("room_rate_not_found", "Không tìm thấy cấu hình giá phòng.");
            if (rate.RoomTypeId != request.RoomTypeId)
                throw new RequestValidationException(new Dictionary<string, string[]> { ["roomTypeId"] = ["Không thể chuyển bảng giá sang hạng phòng khác."] });
            db.Entry(rate).Property(x => x.Version).OriginalValue = version;
            await EnsureRoomTypeAsync(request.RoomTypeId, ct);
            await LockRoomTypeRatesAsync(request.RoomTypeId, ct);
            if (request.IsActive) await EnsureNoOverlapAsync(request, id, ct);
            var before = Snapshot(rate);
            Apply(rate, request);
            auditWriter.Add("UPDATE", "RoomRate", id.ToString(), new { before, after = Snapshot(rate) });
            try { await SaveAsync(ct); }
            catch (DbUpdateConcurrencyException) { throw new ConflictException("room_rate_version_conflict", "Bảng giá đã được cập nhật. Vui lòng tải lại."); }
            return await GetOneAsync(id, ct);
        }, token);
    }

    private async Task EnsureNoOverlapAsync(RoomRateWriteRequest request, long? excludeId, CancellationToken token)
    {
        var end = request.EffectiveTo ?? DateOnly.MaxValue;
        if (await db.RoomRates.AsNoTracking().AnyAsync(x =>
            x.RoomRateId != excludeId && x.RoomTypeId == request.RoomTypeId && x.RateCode == "NET" && x.IsActive
            && x.EffectiveFrom <= end && (x.EffectiveTo == null || x.EffectiveTo >= request.EffectiveFrom), token))
            throw new ConflictException("room_rate_overlap", "Hạng phòng và nhóm giá này đã có mức giá trùng thời gian.");
    }

    private async Task EnsureRoomTypeAsync(int roomTypeId, CancellationToken token)
    {
        if (!await db.RoomTypes.AsNoTracking().AnyAsync(x => x.RoomTypeId == roomTypeId, token))
            throw new ResourceNotFoundException("room_type_not_found", "Không tìm thấy hạng phòng.");
    }

    private async Task LockRoomTypeRatesAsync(int roomTypeId, CancellationToken token)
    {
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            DECLARE @LockedRoomTypeID int;
            SELECT @LockedRoomTypeID = RoomTypeID
            FROM hotel.RoomType WITH (UPDLOCK, HOLDLOCK)
            WHERE RoomTypeID = {roomTypeId};
            """, token);
    }

    private async Task<bool> CloseCurrentOpenRateAsync(RoomRateWriteRequest request, CancellationToken token)
    {
        var coveringRates = await db.RoomRates
            .Where(x => x.RoomTypeId == request.RoomTypeId
                && x.RateCode == "NET"
                && x.IsActive
                && x.EffectiveFrom < request.EffectiveFrom
                && (x.EffectiveTo == null || x.EffectiveTo >= request.EffectiveFrom))
            .OrderByDescending(x => x.EffectiveFrom)
            .ToListAsync(token);

        if (coveringRates.Count > 1)
            throw new ConflictException("room_rate_overlap", "Dữ liệu hiện tại đang có nhiều mức giá chồng thời gian. Vui lòng kiểm tra lại.");
        if (coveringRates.Count == 0) return false;

        var current = coveringRates[0];
        var before = Snapshot(current);
        current.EffectiveTo = request.EffectiveFrom.AddDays(-1);
        StampModification(current);
        auditWriter.Add("AUTO_CLOSE", "RoomRate", current.RoomRateId.ToString(), new
        {
            reason = "Tạo mức giá mới",
            before,
            after = Snapshot(current)
        });
        return true;
    }

    private static void Validate(RoomRateWriteRequest request, bool requireVersion)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.RoomTypeId <= 0) errors["roomTypeId"] = ["Vui lòng chọn hạng phòng."];
        if (request.EffectiveFrom == DateOnly.MinValue) errors["effectiveFrom"] = ["Vui lòng chọn ngày bắt đầu."];
        if (request.EffectiveTo.HasValue && request.EffectiveTo.Value < request.EffectiveFrom) errors["effectiveTo"] = ["Ngày kết thúc phải từ ngày bắt đầu trở đi."];
        if (request.MondayPrice < 0) errors["mondayPrice"] = ["Giá Thứ 2 không được âm."];
        if (request.TuesdayPrice < 0) errors["tuesdayPrice"] = ["Giá Thứ 3 không được âm."];
        if (request.WednesdayPrice < 0) errors["wednesdayPrice"] = ["Giá Thứ 4 không được âm."];
        if (request.ThursdayPrice < 0) errors["thursdayPrice"] = ["Giá Thứ 5 không được âm."];
        if (request.FridayPrice < 0) errors["fridayPrice"] = ["Giá Thứ 6 không được âm."];
        if (request.SaturdayPrice < 0) errors["saturdayPrice"] = ["Giá Thứ 7 không được âm."];
        if (request.SundayPrice < 0) errors["sundayPrice"] = ["Giá Chủ nhật không được âm."];
        if (request.Note?.Trim().Length > 300) errors["note"] = ["Ghi chú tối đa 300 ký tự."];
        if (requireVersion && !TryDecodeVersion(request.Version, out _)) errors["version"] = ["Phiên bản bảng giá không hợp lệ."];
        if (errors.Count > 0) throw new RequestValidationException(errors);
    }

    private void Apply(RoomRate rate, RoomRateWriteRequest request)
    {
        rate.RoomTypeId = request.RoomTypeId;
        rate.RateCode = "NET";
        rate.EffectiveFrom = request.EffectiveFrom;
        rate.EffectiveTo = request.EffectiveTo;
        rate.MondayPrice = request.MondayPrice;
        rate.TuesdayPrice = request.TuesdayPrice;
        rate.WednesdayPrice = request.WednesdayPrice;
        rate.ThursdayPrice = request.ThursdayPrice;
        rate.FridayPrice = request.FridayPrice;
        rate.SaturdayPrice = request.SaturdayPrice;
        rate.SundayPrice = request.SundayPrice;
        rate.WeekdayPrice = request.MondayPrice;
        rate.WeekendPrice = request.FridayPrice;
        rate.IsActive = request.IsActive;
        rate.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        StampModification(rate);
    }

    private void StampModification(RoomRate rate)
    {
        rate.LastModifiedAtUtc = DateTime.UtcNow;
        rate.LastModifiedByObjectId = currentUser.ObjectId;
        rate.LastModifiedByDisplayName = currentUser.DisplayName ?? currentUser.Email ?? currentUser.ObjectId;
    }

    private async Task SaveAsync(CancellationToken token)
    {
        try { await db.SaveChangesAsync(token); }
        catch (DbUpdateException exception) when (FindSqlException(exception)?.Number == 51010)
        { throw new ConflictException("room_rate_overlap", "Hạng phòng đã có mức giá trùng thời gian."); }
        catch (DbUpdateException exception) when (FindSqlException(exception)?.Number is 2601 or 2627)
        { throw new ConflictException("room_rate_exists", "Cấu hình giá này đã tồn tại."); }
    }

    private static RoomRateItem ToItem(RoomRate x) => new(
        x.RoomRateId, x.RoomTypeId, x.RoomType.Code, x.RoomType.Name, x.RateCode,
        x.EffectiveFrom, x.EffectiveTo, x.WeekdayPrice, x.WeekendPrice,
        x.MondayPrice, x.TuesdayPrice, x.WednesdayPrice, x.ThursdayPrice,
        x.FridayPrice, x.SaturdayPrice, x.SundayPrice, x.IsActive,
        x.Note, x.LastModifiedAtUtc, x.LastModifiedByDisplayName, Convert.ToBase64String(x.Version));

    private static object Snapshot(RoomRate x) => new
    {
        x.RoomTypeId,
        x.RateCode,
        x.EffectiveFrom,
        x.EffectiveTo,
        x.MondayPrice,
        x.TuesdayPrice,
        x.WednesdayPrice,
        x.ThursdayPrice,
        x.FridayPrice,
        x.SaturdayPrice,
        x.SundayPrice,
        x.IsActive,
        x.Note
    };

    private static bool TryDecodeVersion(string? value, out byte[] version)
    {
        version = [];
        try { if (string.IsNullOrWhiteSpace(value)) return false; version = Convert.FromBase64String(value); return version.Length == 8; }
        catch (FormatException) { return false; }
    }

    private static SqlException? FindSqlException(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
            if (current is SqlException sqlException) return sqlException;
        return null;
    }

    private sealed record RoomRateHistoryRow(
        long Id,
        DateOnly EffectiveFrom,
        DateOnly? EffectiveTo,
        decimal MondayPrice,
        decimal TuesdayPrice,
        decimal WednesdayPrice,
        decimal ThursdayPrice,
        decimal FridayPrice,
        decimal SaturdayPrice,
        decimal SundayPrice,
        bool IsActive,
        string? Note,
        DateTime RecordedFromUtc,
        DateTime RecordedToUtc,
        DateTime LastModifiedAtUtc,
        string? LastModifiedByDisplayName);
}
