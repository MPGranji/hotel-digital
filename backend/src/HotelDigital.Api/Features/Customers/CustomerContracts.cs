namespace HotelDigital.Api.Features.Customers;

public sealed record CustomerListItem(
    long Id,
    string FullName,
    string? Phone,
    string? Email,
    string? IdentityDocument,
    string? Nationality,
    bool IsActive,
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
    bool IsActive,
    DateTime CreatedAt,
    string Version);

public sealed record CustomerUpsertRequest(
    string FullName,
    string? Phone,
    string? Email,
    string? IdentityDocument,
    string? Nationality,
    string? Note,
    string? Version,
    bool IsActive = true);

public sealed record CustomerDuplicateRequest(
    string? FullName,
    string? Phone,
    string? Email,
    string? IdentityDocument,
    long? ExcludeId);

public sealed record CustomerDuplicateItem(
    long Id,
    string FullName,
    string? Phone,
    string? Email,
    string? IdentityDocument,
    string MatchStrength,
    IReadOnlyList<string> MatchedFields,
    int StayCount);

public sealed record CustomerMergeRequest(long DuplicateCustomerId);

public sealed record CustomerStayItem(
    long BookingId,
    string BookingCode,
    string RoomNumber,
    DateTime CheckInAt,
    DateTime CheckOutAt,
    string Status,
    decimal GrossRevenue);
