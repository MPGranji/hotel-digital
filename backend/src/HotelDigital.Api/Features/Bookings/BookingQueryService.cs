using HotelDigital.Api.Common;
using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Infrastructure.Errors;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Features.Bookings;

public sealed class BookingQueryService(HotelDbContext db)
{
    public async Task<PagedResponse<BookingListItem>> GetPageAsync(
        DateTime? dateFrom,
        DateTime? dateTo,
        int? roomId,
        int? roomTypeId,
        int? channelId,
        string? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        page = Paging.NormalizePage(page);
        pageSize = Paging.NormalizePageSize(pageSize);
        var query = db.Bookings.AsNoTracking();

        if (dateFrom.HasValue) query = query.Where(x => x.CheckInAt >= dateFrom.Value.Date);
        if (dateTo.HasValue)
        {
            var exclusiveDateTo = dateTo.Value.Date.AddDays(1);
            query = query.Where(x => x.CheckInAt < exclusiveDateTo);
        }
        if (roomId.HasValue) query = query.Where(x => x.RoomId == roomId);
        if (roomTypeId.HasValue) query = query.Where(x => x.Room.RoomTypeId == roomTypeId);
        if (channelId.HasValue) query = query.Where(x => x.ChannelId == channelId);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status.Trim().ToUpper());
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x =>
                x.BookingCode.Contains(term)
                || (x.GroupCode != null && x.GroupCode.Contains(term))
                || (x.ExternalBookingCode != null && x.ExternalBookingCode.Contains(term))
                || x.Customer.FullName.Contains(term)
                || (x.Customer.Phone != null && x.Customer.Phone.Contains(term)));
        }

        var totalItems = await query.LongCountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(x => x.CheckInAt)
            .ThenByDescending(x => x.BookingId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new BookingListItem(
                x.BookingId,
                x.BookingCode,
                x.GroupCode,
                x.Room.RoomNumber,
                x.Room.RoomType.Name,
                x.CustomerId,
                x.Customer.FullName,
                x.Customer.Phone,
                x.ChannelId,
                x.Channel.Name,
                x.CheckInAt,
                x.CheckOutAt,
                x.BilledNights,
                x.RoomRevenue,
                x.ServiceRevenue,
                x.GrossRevenue,
                x.PaidAmount,
                x.DebtAmount,
                x.Status,
                Convert.ToBase64String(x.Version)))
            .ToListAsync(cancellationToken);

        return new PagedResponse<BookingListItem>(rows, page, pageSize, totalItems);
    }

    public async Task<BookingDetail> GetAsync(long id, CancellationToken cancellationToken)
    {
        var booking = await db.Bookings.AsNoTracking()
            .Include(x => x.Room).ThenInclude(x => x.RoomType)
            .Include(x => x.Customer)
            .Include(x => x.Channel)
            .SingleOrDefaultAsync(x => x.BookingId == id, cancellationToken)
            ?? throw new ResourceNotFoundException("booking_not_found", "Không tìm thấy đặt phòng.");

        return ToDetail(booking);
    }

    public async Task<BookingOptions> GetOptionsAsync(CancellationToken cancellationToken)
    {
        var roomRows = await db.Rooms.AsNoTracking()
            .Where(x => x.IsActive && x.CountsTowardOccupancy)
            .OrderBy(x => x.RoomNumber)
            .Select(x => new
            {
                x.RoomId,
                x.RoomNumber,
                x.RoomTypeId,
                RoomTypeCode = x.RoomType.Code,
                x.RoomType.Name,
                x.RoomType.Capacity,
                x.RoomType.ListedPricePerNight
            })
            .ToListAsync(cancellationToken);
        var rateRows = await db.RoomRates.AsNoTracking()
            .Where(x => x.IsActive && x.RateCode == "NET")
            .OrderByDescending(x => x.EffectiveFrom)
            .Select(x => new RoomRateRow(
                x.RoomTypeId, x.RateCode, x.WeekdayPrice, x.WeekendPrice, x.EffectiveFrom, x.EffectiveTo,
                x.MondayPrice, x.TuesdayPrice, x.WednesdayPrice, x.ThursdayPrice,
                x.FridayPrice, x.SaturdayPrice, x.SundayPrice))
            .ToListAsync(cancellationToken);
        var rooms = roomRows.Select(x => new BookingRoomOption(
            x.RoomId,
            x.RoomNumber,
            x.RoomTypeCode,
            x.Name,
            x.Capacity,
            x.ListedPricePerNight ?? PhamNguLaoRateCatalog.GetListedPrice(x.RoomTypeCode),
            GetRates(x.RoomTypeId, x.RoomTypeCode, rateRows)))
            .ToList();
        var channels = await db.Channels.AsNoTracking()
            .Where(x => x.IsActive && x.Code != "OFFLINE")
            .OrderBy(x => x.Code == "BOOKED_CTV" ? 0 : x.Category == "DIRECT" ? 1 : 2)
            .ThenBy(x => x.Name)
            .Select(x => new BookingChannelOption(x.ChannelId, x.Code, x.Name, x.Category))
            .ToListAsync(cancellationToken);
        return new BookingOptions(rooms, channels);
    }

    private static IReadOnlyList<BookingRoomRateOption> GetRates(
        int roomTypeId,
        string roomTypeCode,
        IReadOnlyList<RoomRateRow> rateRows)
    {
        var configured = rateRows.Where(x => x.RoomTypeId == roomTypeId)
            .Select(x => new BookingRoomRateOption(
                x.RateCode, x.WeekdayPrice, x.WeekendPrice, x.EffectiveFrom, x.EffectiveTo,
                x.MondayPrice, x.TuesdayPrice, x.WednesdayPrice, x.ThursdayPrice,
                x.FridayPrice, x.SaturdayPrice, x.SundayPrice))
            .ToList();
        if (configured.Count == 0)
            configured.AddRange(PhamNguLaoRateCatalog.GetRates(roomTypeCode).Where(x => x.Code == "NET"));
        return configured;
    }

    private sealed record RoomRateRow(
        int RoomTypeId,
        string RateCode,
        decimal WeekdayPrice,
        decimal WeekendPrice,
        DateOnly EffectiveFrom,
        DateOnly? EffectiveTo,
        decimal MondayPrice,
        decimal TuesdayPrice,
        decimal WednesdayPrice,
        decimal ThursdayPrice,
        decimal FridayPrice,
        decimal SaturdayPrice,
        decimal SundayPrice);

    public async Task<IReadOnlyList<int>> GetAvailableRoomIdsAsync(
        DateTime checkInAt,
        DateTime checkOutAt,
        long? excludeBookingId,
        CancellationToken cancellationToken)
    {
        if (checkOutAt <= checkInAt)
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                ["checkOutAt"] = ["Ngày giờ đi phải sau ngày giờ đến."]
            });

        return await db.Rooms.AsNoTracking()
            .Where(room => room.IsActive && room.CountsTowardOccupancy)
            .Where(room => !room.Blocks.Any(block =>
                block.IsActive
                && block.StartAt < checkOutAt
                && block.EndAt > checkInAt))
            .Where(room => !room.Bookings.Any(booking =>
                booking.BookingId != excludeBookingId
                && booking.Status != "CANCELLED"
                && booking.Status != "NO_SHOW"
                && booking.CheckInAt < checkOutAt
                && booking.CheckOutAt > checkInAt))
            .OrderBy(room => room.RoomNumber)
            .Select(room => room.RoomId)
            .ToListAsync(cancellationToken);
    }

    private static BookingDetail ToDetail(Booking x) => new(
        x.BookingId,
        x.BookingCode,
        x.GroupCode,
        x.RoomId,
        x.Room.RoomNumber,
        x.Room.RoomType.Name,
        x.CustomerId,
        x.Customer.FullName,
        x.ChannelId,
        x.Channel.Name,
        x.ExternalBookingCode,
        x.CheckInAt,
        x.CheckOutAt,
        x.BilledNights,
        x.Status,
        x.RoomRevenue,
        x.ServiceRevenue,
        x.SurchargeAmount,
        x.DiscountAmount,
        x.DiscountReason,
        x.PromotionCode,
        x.PreviousDebt,
        x.CashAmount,
        x.CardAmount,
        x.TransferAmount,
        x.PaidAmount,
        x.DebtAmount,
        x.GrossRevenue,
        x.AverageRoomRate,
        x.InvoiceNumber,
        x.Note,
        Convert.ToBase64String(x.Version));
}
