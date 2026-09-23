using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Features.Bookings;
using HotelDigital.Api.Features.Rooms;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HotelDigital.Api.Tests;

public sealed class RoomStatusTests
{
    [Fact]
    public async Task Checked_in_booking_exposes_current_guest_and_occupied_status()
    {
        await using var db = CreateContext();
        var now = GetHotelNow();
        SeedRoom(db, roomId: 1, roomNumber: "101");
        SeedReferences(db);
        db.Bookings.Add(CreateBooking(1, "CHECKED_IN", now.AddHours(-2), now.AddHours(20)));
        await db.SaveChangesAsync();

        var room = Assert.Single(await CreateService(db).GetAsync(null, null, CancellationToken.None));

        Assert.Equal("OCCUPIED", room.Status);
        Assert.Equal("Khách kiểm thử", room.CurrentGuestName);
        Assert.Equal("0901234567", room.CurrentGuestPhone);
        Assert.Equal(1, room.CurrentBookingId);
        Assert.Equal(now.AddHours(-2), room.CurrentCheckInAt);
        Assert.Equal(now.AddHours(20), room.CurrentCheckOutAt);
    }

    [Fact]
    public async Task Future_booking_keeps_room_available_and_exposes_next_check_in()
    {
        await using var db = CreateContext();
        var now = GetHotelNow();
        SeedRoom(db, roomId: 1, roomNumber: "101");
        SeedReferences(db);
        var nextCheckIn = now.AddDays(2);
        db.Bookings.Add(CreateBooking(2, "BOOKED", nextCheckIn, nextCheckIn.AddDays(1)));
        await db.SaveChangesAsync();

        var room = Assert.Single(await CreateService(db).GetAsync(null, null, CancellationToken.None));

        Assert.Equal("AVAILABLE", room.Status);
        Assert.Null(room.CurrentGuestName);
        Assert.Equal(nextCheckIn, room.NextCheckInAt);
        Assert.Equal(nextCheckIn.AddDays(1), room.NextCheckOutAt);
    }

    [Fact]
    public async Task Maintenance_and_inactive_states_take_precedence()
    {
        await using var db = CreateContext();
        var now = GetHotelNow();
        SeedRoom(db, roomId: 1, roomNumber: "101");
        SeedRoom(db, roomId: 2, roomNumber: "102", isActive: false);
        db.RoomBlocks.Add(new RoomBlock
        {
            RoomBlockId = 1,
            RoomId = 1,
            StartAt = now.AddHours(-1),
            EndAt = now.AddHours(4),
            Reason = "Kiểm thử bảo trì",
            IsActive = true
        });
        await db.SaveChangesAsync();

        var rooms = await CreateService(db).GetAsync(null, null, CancellationToken.None);

        Assert.Equal("MAINTENANCE", rooms.Single(x => x.RoomNumber == "101").Status);
        Assert.Equal("INACTIVE", rooms.Single(x => x.RoomNumber == "102").Status);
    }

    [Fact]
    public async Task Checked_out_booking_keeps_room_held_until_planned_departure()
    {
        await using var db = CreateContext();
        var now = GetHotelNow();
        SeedRoom(db, roomId: 1, roomNumber: "101");
        SeedReferences(db);
        db.Bookings.Add(CreateBooking(1, "CHECKED_OUT", now.AddHours(-2), now.AddHours(2)));
        await db.SaveChangesAsync();

        var calendar = new RoomCalendarService(db, new NoopAuditWriter(), new InlineTransactionExecutor());
        var daily = await calendar.GetAsync(DateOnly.FromDateTime(now), 1, CancellationToken.None);
        var hourly = await calendar.GetHourlyAsync(1, DateOnly.FromDateTime(now), CancellationToken.None);
        var room = Assert.Single(await CreateService(db).GetAsync(null, null, CancellationToken.None));
        var bookingQueries = new BookingQueryService(db);
        var beforeDeparture = await bookingQueries.GetAvailableRoomIdsAsync(now.AddHours(1), now.AddHours(3), null, CancellationToken.None);
        var atDeparture = await bookingQueries.GetAvailableRoomIdsAsync(now.AddHours(2), now.AddHours(3), null, CancellationToken.None);

        Assert.Equal("HELD", room.Status);
        Assert.Equal(now.AddHours(2), room.CurrentCheckOutAt);
        Assert.Equal("CHECKED_OUT", Assert.Single(Assert.Single(daily.Rooms).Cells).Status);
        Assert.Equal("CHECKED_OUT", Assert.Single(hourly.Events).Status);
        Assert.Empty(beforeDeparture);
        Assert.Equal([1], atDeparture);

        var error = await Assert.ThrowsAsync<BusinessRuleException>(() => CreateService(db).UpdateRoomAsync(
            1, new RoomWriteRequest("101", 1, null, false, true, null), CancellationToken.None));
        Assert.Equal("room_has_open_booking", error.Code);
    }

    [Fact]
    public async Task Room_with_booking_history_cannot_change_type_or_leave_occupancy_count()
    {
        await using var db = CreateContext();
        SeedRoom(db, roomId: 1, roomNumber: "101");
        db.RoomTypes.Add(new RoomType { RoomTypeId = 2, Code = "DLX", Name = "Deluxe", Capacity = 3, IsActive = true });
        SeedReferences(db);
        var now = GetHotelNow();
        db.Bookings.Add(CreateBooking(1, "CHECKED_OUT", now.AddDays(-2), now.AddDays(-1)));
        await db.SaveChangesAsync();

        var typeError = await Assert.ThrowsAsync<BusinessRuleException>(() => CreateService(db).UpdateRoomAsync(
            1, new RoomWriteRequest("101", 2, null, true, true, null), CancellationToken.None));
        var occupancyError = await Assert.ThrowsAsync<BusinessRuleException>(() => CreateService(db).UpdateRoomAsync(
            1, new RoomWriteRequest("101", 1, null, true, false, null), CancellationToken.None));

        Assert.Equal("room_type_has_history", typeError.Code);
        Assert.Equal("room_occupancy_has_history", occupancyError.Code);
    }

    [Fact]
    public async Task Room_type_cannot_be_retired_with_active_rooms_or_shrunk_below_prior_guest_count()
    {
        await using var db = CreateContext();
        SeedRoom(db, roomId: 1, roomNumber: "101");
        SeedReferences(db);
        var now = GetHotelNow();
        var booking = CreateBooking(1, "CHECKED_OUT", now.AddDays(-2), now.AddDays(-1));
        booking.GuestCount = 2;
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        var retiredError = await Assert.ThrowsAsync<BusinessRuleException>(() => CreateService(db).UpdateRoomTypeAsync(
            1, new RoomTypeWriteRequest("STD", "Standard", 2, null, false), CancellationToken.None));
        var capacityError = await Assert.ThrowsAsync<BusinessRuleException>(() => CreateService(db).UpdateRoomTypeAsync(
            1, new RoomTypeWriteRequest("STD", "Standard", 1, null, true), CancellationToken.None));
        var codeError = await Assert.ThrowsAsync<BusinessRuleException>(() => CreateService(db).UpdateRoomTypeAsync(
            1, new RoomTypeWriteRequest("NEW", "Standard", 2, null, true), CancellationToken.None));

        Assert.Equal("room_type_has_active_rooms", retiredError.Code);
        Assert.Equal("room_type_capacity_has_history", capacityError.Code);
        Assert.Equal("room_type_code_has_history", codeError.Code);
    }

    [Fact]
    public async Task Booking_room_options_match_available_sellable_rooms()
    {
        await using var db = CreateContext();
        SeedRoom(db, roomId: 1, roomNumber: "101");
        db.RoomTypes.Add(new RoomType { RoomTypeId = 2, Code = "OLD", Name = "Retired", Capacity = 2, IsActive = false });
        db.Rooms.Add(new Room { RoomId = 2, RoomNumber = "102", RoomTypeId = 2, IsActive = true, CountsTowardOccupancy = true });
        db.Rooms.Add(new Room { RoomId = 3, RoomNumber = "103", RoomTypeId = 1, IsActive = true, CountsTowardOccupancy = false });
        await db.SaveChangesAsync();

        var service = new BookingQueryService(db);
        var options = await service.GetOptionsAsync(CancellationToken.None);
        var now = GetHotelNow();
        var available = await service.GetAvailableRoomIdsAsync(now.AddDays(1), now.AddDays(2), null, CancellationToken.None);

        Assert.Equal([1], options.Rooms.Select(x => x.Id));
        Assert.Equal([1], available);
    }

    private static RoomService CreateService(HotelDbContext db) =>
        new(db, new NoopAuditWriter(), new InlineTransactionExecutor());

    private static HotelDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<HotelDbContext>()
            .UseInMemoryDatabase($"room-status-{Guid.NewGuid():N}")
            .Options;
        var db = new HotelDbContext(options);
        db.RoomTypes.Add(new RoomType { RoomTypeId = 1, Code = "STD", Name = "Standard", Capacity = 2, IsActive = true });
        return db;
    }

    private static void SeedRoom(HotelDbContext db, int roomId, string roomNumber, bool isActive = true) =>
        db.Rooms.Add(new Room
        {
            RoomId = roomId,
            RoomNumber = roomNumber,
            RoomTypeId = 1,
            IsActive = isActive,
            CountsTowardOccupancy = true
        });

    private static void SeedReferences(HotelDbContext db)
    {
        db.Customers.Add(new Customer { CustomerId = 1, FullName = "Khách kiểm thử", Phone = "0901234567", IsActive = true });
        db.Channels.Add(new Channel { ChannelId = 1, Code = "DIRECT", Name = "Trực tiếp", Category = "OFFLINE", IsActive = true });
    }

    private static Booking CreateBooking(long id, string status, DateTime checkInAt, DateTime checkOutAt) => new()
    {
        BookingId = id,
        RoomId = 1,
        CustomerId = 1,
        ChannelId = 1,
        BookingMode = "RESERVATION",
        CheckInAt = checkInAt,
        CheckOutAt = checkOutAt,
        BilledNights = 1,
        Status = status
    };

    private static DateTime GetHotelNow()
    {
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, timeZone);
    }

    private sealed class NoopAuditWriter : IAuditWriter
    {
        public void Add(string action, string entityType, string entityId, object changes) { }
    }

    private sealed class InlineTransactionExecutor : ITransactionExecutor
    {
        public Task<T> ExecuteAsync<T>(Func<CancellationToken, Task<T>> operation, CancellationToken cancellationToken) =>
            operation(cancellationToken);
    }
}
