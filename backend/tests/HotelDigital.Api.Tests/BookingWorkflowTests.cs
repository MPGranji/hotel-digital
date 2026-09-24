using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Features.Bookings;
using HotelDigital.Api.Features.Invoices;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using HotelDigital.Api.Infrastructure.Time;
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
        Assert.Equal((short?)1, booking.GuestCount);
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
    public async Task Walk_in_cannot_start_on_a_future_day()
    {
        await using var db = await CreateContextAsync(channelCategory: "OFFLINE");
        var arrival = HotelClock.Now().Date.AddDays(2).AddHours(14);

        var exception = await Assert.ThrowsAsync<BusinessRuleException>(() => CreateService(db).CreateAsync(
            CreateRequest("WALK_IN") with { CheckInAt = arrival, CheckOutAt = arrival.AddDays(1) },
            CancellationToken.None));

        Assert.Equal("walk_in_outside_stay", exception.Code);
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
    public async Task Create_rejects_guest_count_above_room_capacity()
    {
        await using var db = await CreateContextAsync(channelCategory: "OFFLINE");

        var exception = await Assert.ThrowsAsync<RequestValidationException>(() =>
            CreateService(db).CreateAsync(
                CreateRequest("RESERVATION") with { GuestCount = 3 },
                CancellationToken.None));

        Assert.Contains("guestCount", exception.Errors.Keys);
        Assert.Empty(db.Bookings);
    }

    [Fact]
    public async Task Group_booking_accepts_mixed_room_types_and_distributes_total_guests()
    {
        await using var db = await CreateContextAsync(channelCategory: "OFFLINE");
        db.RoomTypes.Add(new RoomType { RoomTypeId = 2, Code = "DLX", Name = "Deluxe", Capacity = 2, IsActive = true });
        db.Rooms.Add(new Room { RoomId = 2, RoomNumber = "201", RoomTypeId = 2, IsActive = true, CountsTowardOccupancy = true });
        await db.SaveChangesAsync();

        await CreateService(db).CreateAsync(
            CreateRequest("RESERVATION") with { AdditionalRoomIds = [2], GuestCount = 3 }, CancellationToken.None);

        var bookings = await db.Bookings.OrderBy(x => x.RoomId).ToListAsync();
        Assert.Equal(2, bookings.Count);
        Assert.Equal(new short?[] { 2, 1 }, bookings.Select(x => x.GuestCount));
        Assert.Single(bookings.Select(x => x.GroupCode).Distinct());
    }

    [Fact]
    public async Task Group_booking_rejects_total_guests_above_combined_capacity()
    {
        await using var db = await CreateContextAsync(channelCategory: "OFFLINE");
        db.Rooms.Add(new Room { RoomId = 2, RoomNumber = "102", RoomTypeId = 1, IsActive = true, CountsTowardOccupancy = true });
        await db.SaveChangesAsync();

        var exception = await Assert.ThrowsAsync<RequestValidationException>(() => CreateService(db).CreateAsync(
            CreateRequest("RESERVATION") with { AdditionalRoomIds = [2], GuestCount = 5 }, CancellationToken.None));

        Assert.Contains("guestCount", exception.Errors.Keys);
        Assert.Empty(db.Bookings);
    }

    [Fact]
    public async Task Future_booking_cannot_be_checked_in_or_marked_no_show_early()
    {
        await using var db = await CreateContextAsync(channelCategory: "OFFLINE");
        var service = CreateService(db);
        var arrival = HotelClock.Now().Date.AddDays(3).AddHours(14);
        var id = await service.CreateAsync(CreateRequest("RESERVATION") with
        {
            CheckInAt = arrival,
            CheckOutAt = arrival.AddDays(1)
        }, CancellationToken.None);
        var booking = await db.Bookings.SingleAsync(x => x.BookingId == id);
        booking.Version = [1, 2, 3, 4, 5, 6, 7, 8];
        await db.SaveChangesAsync();
        var request = new BookingStatusRequest(Convert.ToBase64String(booking.Version));

        var checkIn = await Assert.ThrowsAsync<BusinessRuleException>(() => service.ChangeStatusAsync(
            id, "CHECKED_IN", request, CancellationToken.None));
        var noShow = await Assert.ThrowsAsync<BusinessRuleException>(() => service.ChangeStatusAsync(
            id, "NO_SHOW", request, CancellationToken.None));

        Assert.Equal("check_in_outside_stay", checkIn.Code);
        Assert.Equal("no_show_too_early", noShow.Code);
        Assert.Equal("BOOKED", booking.Status);
    }

    [Fact]
    public async Task Create_preserves_unknown_guest_count_as_null()
    {
        await using var db = await CreateContextAsync(channelCategory: "OFFLINE");

        var id = await CreateService(db).CreateAsync(
            CreateRequest("RESERVATION") with { GuestCount = null },
            CancellationToken.None);

        Assert.Null((await db.Bookings.SingleAsync(x => x.BookingId == id)).GuestCount);
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

    [Fact]
    public async Task Checked_in_booking_can_add_service_and_surcharge_before_checkout()
    {
        await using var db = await CreateContextAsync(channelCategory: "OFFLINE");
        var service = CreateService(db);
        var id = await service.CreateAsync(CreateRequest("WALK_IN"), CancellationToken.None);
        var booking = await db.Bookings.SingleAsync(x => x.BookingId == id);
        booking.Version = [1, 2, 3, 4, 5, 6, 7, 8];
        await db.SaveChangesAsync();

        await service.UpdateAsync(id, CreateRequest("WALK_IN") with
        {
            ServiceRevenue = 150_000,
            SurchargeAmount = 50_000,
            Version = Convert.ToBase64String(booking.Version)
        }, CancellationToken.None);

        Assert.Equal("CHECKED_IN", booking.Status);
        Assert.Equal(150_000, booking.ServiceRevenue);
        Assert.Equal(50_000, booking.SurchargeAmount);
    }

    [Fact]
    public async Task Booking_with_issued_invoice_cannot_be_cancelled()
    {
        await using var db = await CreateContextAsync(channelCategory: "OFFLINE");
        var service = CreateService(db);
        var id = await service.CreateAsync(CreateRequest("RESERVATION"), CancellationToken.None);
        var booking = await db.Bookings.Include(x => x.Invoice).SingleAsync(x => x.BookingId == id);
        booking.Version = [1, 2, 3, 4, 5, 6, 7, 8];
        booking.Invoice!.Status = "ISSUED";
        await db.SaveChangesAsync();

        var exception = await Assert.ThrowsAsync<BusinessRuleException>(() => service.ChangeStatusAsync(
            id, "CANCELLED", new BookingStatusRequest(Convert.ToBase64String(booking.Version)), CancellationToken.None));

        Assert.Equal("issued_invoice_cannot_be_cancelled", exception.Code);
        Assert.Equal("BOOKED", booking.Status);
    }

    [Fact]
    public async Task Invoice_status_cannot_be_voided_independently_of_booking()
    {
        await using var db = await CreateContextAsync(channelCategory: "OFFLINE");
        var id = await CreateService(db).CreateAsync(CreateRequest("RESERVATION"), CancellationToken.None);
        var invoice = await db.Invoices.SingleAsync(x => x.BookingId == id);
        invoice.Version = [1, 2, 3, 4, 5, 6, 7, 8];
        await db.SaveChangesAsync();
        var service = new InvoiceService(db, new NoopAuditWriter(), new InlineTransactionExecutor());

        var exception = await Assert.ThrowsAsync<BusinessRuleException>(() => service.UpdateAsync(
            invoice.InvoiceId,
            new InvoiceWriteRequest(id, invoice.InvoiceNumber, "VOID", null, Convert.ToBase64String(invoice.Version)),
            CancellationToken.None));

        Assert.Equal("invoice_status_managed_by_booking", exception.Code);
        Assert.Equal("DRAFT", invoice.Status);
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
        db.RoomTypes.Add(new RoomType { RoomTypeId = 1, Code = "STD", Name = "Standard", Capacity = 2, IsActive = true });
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
        CheckInAt: bookingMode == "WALK_IN" ? HotelClock.Now().AddMinutes(-1) : new DateTime(2026, 10, 10, 14, 0, 0),
        CheckOutAt: bookingMode == "WALK_IN" ? HotelClock.Now().AddDays(1) : new DateTime(2026, 10, 11, 12, 0, 0),
        BilledNights: 1,
        GuestCount: 1,
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
