using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Features.Invoices;

public sealed record InvoiceLifecycleResult(Invoice Invoice, bool Created, string PreviousStatus);

public sealed class InvoiceLifecycleService(HotelDbContext db)
{
    public async Task<InvoiceLifecycleResult> EnsureAsync(
        Booking booking,
        bool issue,
        CancellationToken cancellationToken)
    {
        var invoice = booking.Invoice
            ?? await db.Invoices.SingleOrDefaultAsync(x => x.BookingId == booking.BookingId, cancellationToken);
        var created = invoice is null;

        if (invoice is null)
        {
            invoice = new Invoice
            {
                BookingId = booking.BookingId,
                Booking = booking,
                InvoiceNumber = $"INV-{HotelClock.Now():yyyyMMdd}-{booking.BookingId:000000}",
                Status = "DRAFT"
            };
            db.Invoices.Add(invoice);
            booking.Invoice = invoice;
            booking.InvoiceNumber = invoice.InvoiceNumber;
        }

        var previousStatus = invoice.Status;
        booking.Invoice = invoice;
        booking.InvoiceNumber = invoice.InvoiceNumber;
        if (invoice.Status == "VOID")
        {
            throw new BusinessRuleException(
                "invoice_is_void",
                "Hóa đơn của booking đã bị hủy nên không thể tiếp tục cập nhật tài chính hoặc lưu trú.");
        }

        SyncAmounts(invoice, booking);
        if (issue)
        {
            invoice.Status = "ISSUED";
            invoice.IssuedAt ??= HotelClock.Now();
        }

        return new InvoiceLifecycleResult(invoice, created, previousStatus);
    }

    public async Task<InvoiceLifecycleResult?> VoidDraftAsync(
        Booking booking,
        CancellationToken cancellationToken)
    {
        var invoice = booking.Invoice
            ?? await db.Invoices.SingleOrDefaultAsync(x => x.BookingId == booking.BookingId, cancellationToken);
        if (invoice is null || invoice.Status != "DRAFT") return null;

        var previousStatus = invoice.Status;
        invoice.Status = "VOID";
        invoice.BalanceDue = 0;
        return new InvoiceLifecycleResult(invoice, false, previousStatus);
    }

    private static void SyncAmounts(Invoice invoice, Booking booking)
    {
        invoice.GrossAmount = booking.GrossRevenue;
        invoice.PaidAmount = booking.PaidAmount;
        invoice.DebtAmount = booking.DebtAmount;
        invoice.BalanceDue = booking.BalanceDue;
    }
}
