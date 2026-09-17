namespace HotelDigital.Api.Features.Invoices;

public sealed record InvoiceItem(
    long Id,
    long BookingId,
    string BookingCode,
    string CustomerName,
    string RoomNumber,
    string InvoiceNumber,
    DateTime? IssuedAt,
    string Status,
    decimal GrossAmount,
    decimal PaidAmount,
    decimal DebtAmount,
    decimal BalanceDue,
    string? Note,
    DateTime CreatedAt,
    string Version);

public sealed record InvoiceWriteRequest(
    long BookingId,
    string? InvoiceNumber,
    string Status,
    string? Note,
    string? Version);
