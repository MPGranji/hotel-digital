using HotelDigital.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Features.Rooms;

public sealed class RoomService(HotelDbContext db)
{
    public async Task<IReadOnlyList<RoomListItem>> GetAsync(
        string? search,
        string? status,
        CancellationToken cancellationToken)
    {
        var now = GetHotelNow();
        var query = db.Rooms.AsNoTracking()
            .Where(room => room.CountsTowardOccupancy)
            .Select(room => new
            {
                room.RoomId,
                room.RoomNumber,
                RoomTypeCode = room.RoomType.Code,
                RoomTypeName = room.RoomType.Name,
                room.FloorLabel,
                room.RoomType.ListedPricePerNight,
                room.IsActive,
                Current = room.Bookings
                    .Where(booking =>
                        booking.Status == "CHECKED_IN"
                        || (booking.Status == "BOOKED"
                            && booking.CheckInAt <= now
                            && booking.CheckOutAt > now))
                    .OrderBy(booking => booking.Status == "CHECKED_IN" ? 0 : 1)
                    .ThenBy(booking => booking.CheckInAt)
                    .Select(booking => new
                    {
                        booking.BookingId,
                        booking.BookingCode,
                        booking.Status,
                        booking.Customer.FullName
                    })
                    .FirstOrDefault(),
                NextCheckInAt = room.Bookings
                    .Where(booking => booking.Status == "BOOKED" && booking.CheckInAt > now)
                    .Min(booking => (DateTime?)booking.CheckInAt)
            });

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x =>
                x.RoomNumber.Contains(term)
                || x.RoomTypeName.Contains(term)
                || (x.FloorLabel != null && x.FloorLabel.Contains(term)));
        }

        var rows = await query.OrderBy(x => x.RoomNumber).ToListAsync(cancellationToken);
        var result = rows.Select(x => new RoomListItem(
            x.RoomId,
            x.RoomNumber,
            x.RoomTypeCode,
            x.RoomTypeName,
            x.FloorLabel,
            x.ListedPricePerNight,
            GetStatus(x.IsActive, x.Current?.Status),
            x.Current?.BookingId,
            x.Current?.BookingCode,
            x.Current?.FullName,
            x.NextCheckInAt));

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToUpperInvariant();
            result = result.Where(x => x.Status == normalizedStatus);
        }

        return result.ToList();
    }

    private static string GetStatus(bool isActive, string? bookingStatus) => (isActive, bookingStatus) switch
    {
        (false, _) => "INACTIVE",
        (true, "CHECKED_IN") => "OCCUPIED",
        (true, "BOOKED") => "RESERVED",
        _ => "AVAILABLE"
    };

    private static DateTime GetHotelNow()
    {
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, timeZone);
    }
}
