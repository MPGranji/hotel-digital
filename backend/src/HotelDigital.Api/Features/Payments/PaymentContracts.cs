namespace HotelDigital.Api.Features.Payments;

public sealed record PaymentItem(
    long Id,
    long BookingId,
    decimal Amount,
    string Method,
    DateTime PaidAt,
    string? ReferenceCode,
    string? Note,
    string Version);

public sealed record PaymentWriteRequest(
    decimal Amount,
    string Method,
    DateTime? PaidAt,
    string? ReferenceCode,
    string? Note);
