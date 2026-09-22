using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Features.Rooms;
using HotelDigital.Api.Infrastructure.Auditing;
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

    private static RoomService CreateService(HotelDbContext db) =>
        new(db, new NoopAuditWriter(), new InlineTransactionExecutor());

    private static HotelDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<HotelDbContext>()
            .UseInMemoryDatabase($"room-status-{Guid.NewGuid():N}")
            .Options;
        var db = new HotelDbContext(options);
        db.RoomTypes.Add(new RoomType { RoomTypeId = 1, Code = "STD", Name = "Standard", Capacity = 2 });
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
