using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Features.Bookings;
using HotelDigital.Api.Features.Invoices;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HotelDigital.Api.Tests;

public sealed class BookingWorkflowTests
{
    [Theory]
    [InlineData("RESERVATION", "BOOKED")]
    [InlineData("WALK_IN", "CHECKED_IN")]
    public async Task Create_sets_expected_operational_status_and_creates_invoice(
        string bookingMode,
        string expectedStatus)
    {
        await using var db = await CreateContextAsync(channelCategory: "OFFLINE");
        var service = CreateService(db);

        var id = await service.CreateAsync(CreateRequest(bookingMode), CancellationToken.None);
        var booking = await db.Bookings.Include(x => x.Invoice).SingleAsync(x => x.BookingId == id);

        Assert.Equal(expectedStatus, booking.Status);
        Assert.Equal(bookingMode, booking.BookingMode);
        Assert.NotNull(booking.Invoice);
        Assert.Equal("DRAFT", booking.Invoice.Status);
        Assert.Equal(booking.Invoice.InvoiceNumber, booking.InvoiceNumber);
    }

    [Fact]
    public async Task Walk_in_cannot_be_assigned_to_online_channel()
    {
        await using var db = await CreateContextAsync(channelCategory: "ONLINE");
        var service = CreateService(db);

        var exception = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            service.CreateAsync(CreateRequest("WALK_IN"), CancellationToken.None));

        Assert.Equal("walk_in_channel_invalid", exception.Code);
        Assert.Empty(db.Bookings);
    }

    [Fact]
    public async Task Create_rejects_overlapping_booking_for_same_room()
    {
        await using var db = await CreateContextAsync(channelCategory: "OFFLINE");
        db.Bookings.Add(new Booking
        {
            BookingId = 100,
            RoomId = 1,
            CustomerId = 1,
            ChannelId = 1,
            BookingMode = "RESERVATION",
            CheckInAt = new DateTime(2026, 10, 10, 14, 0, 0),
            CheckOutAt = new DateTime(2026, 10, 12, 12, 0, 0),
            BilledNights = 2,
            Status = "BOOKED"
        });
        await db.SaveChangesAsync();

        var exception = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            CreateService(db).CreateAsync(CreateRequest("RESERVATION"), CancellationToken.None));

        Assert.Equal("room_time_conflict", exception.Code);
        Assert.Single(db.Bookings);
    }

    [Fact]
    public async Task Update_does_not_rewrite_payment_ledger_totals()
    {
        await using var db = await CreateContextAsync(channelCategory: "OFFLINE");
        var service = CreateService(db);
        var id = await service.CreateAsync(
            CreateRequest("RESERVATION") with { CashAmount = 100_000 },
            CancellationToken.None);
        var booking = await db.Bookings.Include(x => x.Payments).SingleAsync(x => x.BookingId == id);
        booking.Version = [1, 2, 3, 4, 5, 6, 7, 8];
        await db.SaveChangesAsync();

        await service.UpdateAsync(
            id,
            CreateRequest("RESERVATION") with
            {
                CashAmount = 400_000,
                CardAmount = 50_000,
                Note = "Chỉ sửa ghi chú",
                Version = Convert.ToBase64String(booking.Version)
            },
            CancellationToken.None);

        var updated = await db.Bookings.Include(x => x.Payments).SingleAsync(x => x.BookingId == id);
        Assert.Equal(100_000, updated.CashAmount);
        Assert.Equal(0, updated.CardAmount);
        Assert.Equal(100_000, updated.Payments.Sum(x => x.Amount));
        Assert.Single(updated.Payments);
        Assert.Equal("Chỉ sửa ghi chú", updated.Note);
    }

    [Fact]
    public async Task Update_cannot_reduce_total_below_recorded_collection()
    {
        await using var db = await CreateContextAsync(channelCategory: "OFFLINE");
        var service = CreateService(db);
        var id = await service.CreateAsync(
            CreateRequest("RESERVATION") with { CashAmount = 100_000 },
            CancellationToken.None);
        var booking = await db.Bookings.SingleAsync(x => x.BookingId == id);
        booking.Version = [1, 2, 3, 4, 5, 6, 7, 8];
        await db.SaveChangesAsync();

        var exception = await Assert.ThrowsAsync<BusinessRuleException>(() => service.UpdateAsync(
            id,
            CreateRequest("RESERVATION") with
            {
                RoomRevenue = 50_000,
                Version = Convert.ToBase64String(booking.Version)
            },
            CancellationToken.None));

        Assert.Equal("booking_total_below_settlement", exception.Code);
        Assert.Equal(500_000, booking.RoomRevenue);
    }

    private static BookingCommandService CreateService(HotelDbContext db) => new(
        db,
        new NoopAuditWriter(),
        new InlineTransactionExecutor(),
        new InvoiceLifecycleService(db));

    private static async Task<HotelDbContext> CreateContextAsync(string channelCategory)
    {
        var options = new DbContextOptionsBuilder<HotelDbContext>()
            .UseInMemoryDatabase($"booking-workflow-{Guid.NewGuid():N}")
            .Options;
        var db = new HotelDbContext(options);
        db.RoomTypes.Add(new RoomType { RoomTypeId = 1, Code = "STD", Name = "Standard", Capacity = 2 });
        db.Rooms.Add(new Room
        {
            RoomId = 1,
            RoomNumber = "101",
            RoomTypeId = 1,
            IsActive = true,
            CountsTowardOccupancy = true
        });
        db.Customers.Add(new Customer { CustomerId = 1, FullName = "Khách kiểm thử", IsActive = true });
        db.Channels.Add(new Channel
        {
            ChannelId = 1,
            Code = channelCategory == "ONLINE" ? "ONLINE" : "DIRECT",
            Name = channelCategory == "ONLINE" ? "Online" : "Đặt trực tiếp",
            Category = channelCategory,
            IsActive = true
        });
        await db.SaveChangesAsync();
        return db;
    }

    private static BookingWriteRequest CreateRequest(string bookingMode) => new(
        RoomId: 1,
        CustomerId: 1,
        NewCustomer: null,
        ChannelId: 1,
        BookingMode: bookingMode,
        ExternalBookingCode: null,
        CheckInAt: new DateTime(2026, 10, 10, 14, 0, 0),
        CheckOutAt: new DateTime(2026, 10, 11, 12, 0, 0),
        BilledNights: 1,
        RoomRevenue: 500_000,
        ServiceRevenue: 0,
        SurchargeAmount: 0,
        DiscountAmount: 0,
        DiscountReason: null,
        PromotionCode: null,
        PreviousDebt: 0,
        CashAmount: 0,
        CardAmount: 0,
        TransferAmount: 0,
        DebtAmount: 0,
        InvoiceNumber: null,
        Note: null,
        Version: null);

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
