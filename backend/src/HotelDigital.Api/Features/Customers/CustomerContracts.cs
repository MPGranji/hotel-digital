namespace HotelDigital.Api.Features.Customers;

public sealed record CustomerListItem(
    long Id,
    string FullName,
    string? Phone,
    string? Email,
    string? IdentityDocument,
    string? Nationality,
    DateTime? LastCheckInAt,
    int StayCount,
    string Version);

public sealed record CustomerDetail(
    long Id,
    string FullName,
    string? Phone,
    string? Email,
    string? IdentityDocument,
    string? Nationality,
    string? Note,
    DateTime CreatedAt,
    string Version);

public sealed record CustomerUpsertRequest(
    string FullName,
    string? Phone,
    string? Email,
    string? IdentityDocument,
    string? Nationality,
    string? Note,
    string? Version);

public sealed record CustomerStayItem(
    long BookingId,
    string BookingCode,
    string RoomNumber,
    DateTime CheckInAt,
    DateTime CheckOutAt,
    string Status,
    decimal GrossRevenue);
