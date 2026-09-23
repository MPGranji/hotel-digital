using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Features.Bookings;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HotelDigital.Api.Tests;

public sealed class BookingOperationsTests
{
    [Fact]
    public async Task Operations_include_open_stays_and_only_the_next_seven_days_of_arrivals()
    {
        var options = new DbContextOptionsBuilder<HotelDbContext>()
            .UseInMemoryDatabase($"booking-operations-{Guid.NewGuid():N}")
            .Options;
        await using var db = new HotelDbContext(options);
        db.RoomTypes.Add(new RoomType { RoomTypeId = 1, Code = "STD", Name = "Standard", Capacity = 2, IsActive = true });
        db.Rooms.Add(new Room { RoomId = 1, RoomNumber = "101", RoomTypeId = 1, IsActive = true });
        db.Customers.Add(new Customer { CustomerId = 1, FullName = "Khách kiểm thử", IsActive = true });
        db.Channels.Add(new Channel { ChannelId = 1, Code = "DIRECT", Name = "Trực tiếp", Category = "OFFLINE", IsActive = true });

        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(
            DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time")));
        var midnight = today.ToDateTime(TimeOnly.MinValue);
        db.Bookings.AddRange(
            Booking(1, "BOOKED", midnight.AddDays(-1), midnight.AddDays(1), previousDebt: 120_000),
            Booking(2, "CHECKED_IN", midnight.AddDays(-3), midnight.AddDays(-1)),
            Booking(3, "BOOKED", midnight.AddDays(7).AddHours(14), midnight.AddDays(8)),
            Booking(4, "BOOKED", midnight.AddDays(8).AddHours(14), midnight.AddDays(9)),
            Booking(5, "CHECKED_OUT", midnight.AddDays(-2), midnight.AddDays(-1)),
            Booking(6, "CANCELLED", midnight.AddHours(14), midnight.AddDays(1)));
        await db.SaveChangesAsync();

        var result = await new BookingQueryService(db).GetOperationsAsync(CancellationToken.None);

        Assert.Equal(today, result.HotelDate);
        Assert.Equal([1L, 2L, 3L], result.Items.Select(x => x.Id).Order().ToArray());
        Assert.Equal(120_000, result.Items.Single(x => x.Id == 1).PreviousDebt);
    }

    private static Booking Booking(long id, string status, DateTime checkIn, DateTime checkOut, decimal previousDebt = 0) => new()
    {
        BookingId = id,
        RoomId = 1,
        CustomerId = 1,
        ChannelId = 1,
        CheckInAt = checkIn,
        CheckOutAt = checkOut,
        BilledNights = 1,
        PreviousDebt = previousDebt,
        Status = status
    };
}
