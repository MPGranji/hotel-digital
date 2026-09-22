using System.Reflection;
using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Features.Invoices;
using HotelDigital.Api.Infrastructure.Errors;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HotelDigital.Api.Tests;

public sealed class InvoiceLifecycleTests
{
    [Fact]
    public async Task Ensure_creates_draft_invoice_and_copies_booking_totals()
    {
        await using var db = CreateContext();
        var booking = CreateBooking(42, gross: 1_500_000, paid: 500_000, debt: 250_000, balance: 750_000);
        db.Bookings.Add(booking);

        var result = await new InvoiceLifecycleService(db).EnsureAsync(booking, issue: false, CancellationToken.None);

        Assert.True(result.Created);
        Assert.Equal("DRAFT", result.Invoice.Status);
        Assert.Equal("INV-", result.Invoice.InvoiceNumber[..4]);
        Assert.EndsWith("000042", result.Invoice.InvoiceNumber, StringComparison.Ordinal);
        Assert.Equal(1_500_000, result.Invoice.GrossAmount);
        Assert.Equal(500_000, result.Invoice.PaidAmount);
        Assert.Equal(250_000, result.Invoice.DebtAmount);
        Assert.Equal(750_000, result.Invoice.BalanceDue);
        Assert.Same(result.Invoice, booking.Invoice);
        Assert.Equal(result.Invoice.InvoiceNumber, booking.InvoiceNumber);
    }

    [Fact]
    public async Task Ensure_syncs_existing_draft_after_payment_changes()
    {
        await using var db = CreateContext();
        var booking = CreateBooking(7, gross: 900_000, paid: 900_000, debt: 0, balance: 0);
        var invoice = CreateInvoice(booking, "DRAFT", paid: 100_000, balance: 800_000);

        var result = await new InvoiceLifecycleService(db).EnsureAsync(booking, issue: false, CancellationToken.None);

        Assert.False(result.Created);
        Assert.Equal("DRAFT", result.Invoice.Status);
        Assert.Equal(900_000, result.Invoice.PaidAmount);
        Assert.Equal(0, result.Invoice.BalanceDue);
    }

    [Fact]
    public async Task Ensure_issues_invoice_when_booking_checks_out()
    {
        await using var db = CreateContext();
        var booking = CreateBooking(8, gross: 700_000, paid: 700_000, debt: 0, balance: 0);
        CreateInvoice(booking, "DRAFT", paid: 700_000, balance: 0);

        var before = DateTime.Now.AddSeconds(-1);
        var result = await new InvoiceLifecycleService(db).EnsureAsync(booking, issue: true, CancellationToken.None);

        Assert.Equal("ISSUED", result.Invoice.Status);
        Assert.NotNull(result.Invoice.IssuedAt);
        Assert.True(result.Invoice.IssuedAt >= before);
    }

    [Fact]
    public async Task VoidDraft_voids_only_draft_invoice()
    {
        await using var db = CreateContext();
        var booking = CreateBooking(9, gross: 600_000, paid: 0, debt: 0, balance: 600_000);
        CreateInvoice(booking, "DRAFT", paid: 0, balance: 600_000);

        var result = await new InvoiceLifecycleService(db).VoidDraftAsync(booking, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("VOID", result.Invoice.Status);
    }

    [Fact]
    public async Task Ensure_rejects_changes_when_invoice_is_void()
    {
        await using var db = CreateContext();
        var booking = CreateBooking(10, gross: 600_000, paid: 0, debt: 0, balance: 600_000);
        CreateInvoice(booking, "VOID", paid: 0, balance: 600_000);

        var exception = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            new InvoiceLifecycleService(db).EnsureAsync(booking, issue: false, CancellationToken.None));

        Assert.Equal("invoice_is_void", exception.Code);
    }

    private static HotelDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<HotelDbContext>()
            .UseInMemoryDatabase($"invoice-lifecycle-{Guid.NewGuid():N}")
            .Options;
        return new HotelDbContext(options);
    }

    private static Booking CreateBooking(long id, decimal gross, decimal paid, decimal debt, decimal balance)
    {
        var booking = new Booking
        {
            BookingId = id,
            RoomId = 1,
            CustomerId = 1,
            ChannelId = 1,
            CheckInAt = new DateTime(2026, 9, 22, 14, 0, 0),
            CheckOutAt = new DateTime(2026, 9, 23, 12, 0, 0),
            BilledNights = 1,
            RoomRevenue = gross,
            DebtAmount = debt
        };
        SetGeneratedAmount(booking, nameof(Booking.GrossRevenue), gross);
        SetGeneratedAmount(booking, nameof(Booking.PaidAmount), paid);
        SetGeneratedAmount(booking, nameof(Booking.BalanceDue), balance);
        return booking;
    }

    private static Invoice CreateInvoice(Booking booking, string status, decimal paid, decimal balance)
    {
        var invoice = new Invoice
        {
            BookingId = booking.BookingId,
            Booking = booking,
            InvoiceNumber = $"INV-TEST-{booking.BookingId}",
            Status = status,
            GrossAmount = booking.GrossRevenue,
            PaidAmount = paid,
            DebtAmount = booking.DebtAmount,
            BalanceDue = balance
        };
        booking.Invoice = invoice;
        booking.InvoiceNumber = invoice.InvoiceNumber;
        return invoice;
    }

    private static void SetGeneratedAmount(Booking booking, string propertyName, decimal value)
    {
        typeof(Booking).GetProperty(propertyName, BindingFlags.Instance | BindingFlags.Public)!
            .SetValue(booking, value);
    }
}
