using System.Reflection;
using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Features.Invoices;
using HotelDigital.Api.Features.Payments;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using HotelDigital.Api.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HotelDigital.Api.Tests;

public sealed class PaymentLedgerTests
{
    [Fact]
    public async Task Recorded_payment_updates_ledger_and_compatibility_total()
    {
        await using var db = await CreateContextAsync();
        var service = CreateService(db);

        var item = await service.CreateAsync(
            1,
            new PaymentWriteRequest(200_000, "CASH", null, null, "Tiền cọc tại quầy"),
            CancellationToken.None);

        var booking = await db.Bookings.Include(x => x.Payments).SingleAsync();
        Assert.Equal(200_000, item.Amount);
        Assert.Equal("Tiền cọc tại quầy", item.Note);
        Assert.Equal(200_000, booking.CashAmount);
        Assert.Single(booking.Payments);
    }

    [Fact]
    public async Task Recorded_payment_cannot_exceed_remaining_amount()
    {
        await using var db = await CreateContextAsync();
        var service = CreateService(db);
        await service.CreateAsync(
            1,
            new PaymentWriteRequest(400_000, "TRANSFER", null, "REF-01", null),
            CancellationToken.None);

        var exception = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            service.CreateAsync(
                1,
                new PaymentWriteRequest(100_001, "CASH", null, null, null),
                CancellationToken.None));

        Assert.Equal("payment_exceeds_balance", exception.Code);
        Assert.Single(db.Payments);
    }

    [Theory]
    [InlineData("0.001")]
    [InlineData("100.001")]
    public async Task Recorded_payment_rejects_amounts_that_sql_would_round(string value)
    {
        await using var db = await CreateContextAsync();

        var exception = await Assert.ThrowsAsync<RequestValidationException>(() => CreateService(db).CreateAsync(
            1, new PaymentWriteRequest(decimal.Parse(value, System.Globalization.CultureInfo.InvariantCulture), "CASH", null, null, null), CancellationToken.None));

        Assert.Contains("amount", exception.Errors.Keys);
        Assert.Empty(db.Payments);
    }

    [Fact]
    public async Task Recorded_payment_rejects_future_collection_time()
    {
        await using var db = await CreateContextAsync();

        var exception = await Assert.ThrowsAsync<RequestValidationException>(() => CreateService(db).CreateAsync(
            1, new PaymentWriteRequest(100_000, "CASH", HotelClock.Now().AddDays(1), null, null), CancellationToken.None));

        Assert.Contains("paidAt", exception.Errors.Keys);
        Assert.Empty(db.Payments);
    }

    [Fact]
    public async Task Cancelled_booking_refund_records_negative_payment_and_cannot_repeat()
    {
        await using var db = await CreateContextAsync();
        var service = CreateService(db);
        await service.CreateAsync(1, new PaymentWriteRequest(200_000, "CASH", null, null, "Cọc"), CancellationToken.None);
        await service.CreateAsync(1, new PaymentWriteRequest(100_000, "TRANSFER", null, null, "Cọc"), CancellationToken.None);
        var booking = await db.Bookings.SingleAsync();
        booking.Status = "CANCELLED";
        await db.SaveChangesAsync();

        var refunds = await service.RefundDepositAsync(1, CancellationToken.None);

        Assert.Equal(2, refunds.Count);
        Assert.Equal(-300_000, refunds.Sum(x => x.Amount));
        Assert.Equal(0, db.Payments.Sum(x => x.Amount));
        Assert.Equal(0, booking.CashAmount);
        Assert.Equal(0, booking.TransferAmount);
        var exception = await Assert.ThrowsAsync<BusinessRuleException>(() => service.RefundDepositAsync(1, CancellationToken.None));
        Assert.Equal("deposit_already_refunded", exception.Code);
    }

    [Fact]
    public async Task Active_booking_cannot_record_deposit_refund()
    {
        await using var db = await CreateContextAsync();
        var service = CreateService(db);
        await service.CreateAsync(1, new PaymentWriteRequest(200_000, "CASH", null, null, "Cọc"), CancellationToken.None);

        var exception = await Assert.ThrowsAsync<BusinessRuleException>(() => service.RefundDepositAsync(1, CancellationToken.None));

        Assert.Equal("refund_requires_cancelled_booking", exception.Code);
        Assert.Single(db.Payments);
    }

    private static PaymentService CreateService(HotelDbContext db) => new(
        db,
        new NoopAuditWriter(),
        new InlineTransactionExecutor(),
        new InvoiceLifecycleService(db));

    private static async Task<HotelDbContext> CreateContextAsync()
    {
        var options = new DbContextOptionsBuilder<HotelDbContext>()
            .UseInMemoryDatabase($"payment-ledger-{Guid.NewGuid():N}")
            .Options;
        var db = new HotelDbContext(options);
        var booking = new Booking
        {
            BookingId = 1,
            RoomId = 1,
            CustomerId = 1,
            ChannelId = 1,
            CheckInAt = new DateTime(2026, 9, 22, 14, 0, 0),
            CheckOutAt = new DateTime(2026, 9, 23, 12, 0, 0),
            BilledNights = 1,
            Status = "BOOKED",
            RoomRevenue = 500_000
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();
        typeof(Booking).GetProperty(nameof(Booking.GrossRevenue), BindingFlags.Instance | BindingFlags.Public)!
            .SetValue(booking, 500_000m);
        return db;
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
