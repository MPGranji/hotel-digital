namespace HotelDigital.Api.Features.Rooms;

public sealed record RoomListItem(
    int Id,
    string RoomNumber,
    int RoomTypeId,
    string RoomTypeCode,
    string RoomTypeName,
    short Capacity,
    string? FloorLabel,
    decimal? ListedPricePerNight,
    bool IsActive,
    bool CountsTowardOccupancy,
    string? Note,
    int BookingCount,
    string Status,
    long? CurrentBookingId,
    string? CurrentBookingCode,
    string? CurrentGuestName,
    DateTime? NextCheckInAt);

public sealed record RoomWriteRequest(
    string RoomNumber,
    int RoomTypeId,
    string? FloorLabel,
    bool IsActive,
    bool CountsTowardOccupancy,
    string? Note);

public sealed record RoomTypeItem(
    int Id,
    string Code,
    string Name,
    short Capacity,
    decimal? ListedPricePerNight,
    bool IsActive,
    int RoomCount);

public sealed record RoomTypeWriteRequest(
    string Code,
    string Name,
    short Capacity,
    decimal? ListedPricePerNight,
    bool IsActive);

public sealed record RoomCalendarResponse(
    DateOnly DateFrom,
    DateOnly DateTo,
    IReadOnlyList<DateOnly> Dates,
    IReadOnlyList<RoomCalendarRow> Rooms);

public sealed record RoomCalendarRow(
    int RoomId,
    string RoomNumber,
    string RoomTypeName,
    string? FloorLabel,
    IReadOnlyList<RoomCalendarCell> Cells);

public sealed record RoomCalendarCell(
    DateOnly Date,
    string Status,
    long? BookingId,
    string? BookingCode,
    string? CustomerName,
    long? RoomBlockId,
    string? MaintenanceReason);

public sealed record RoomBlockItem(
    long Id,
    int RoomId,
    string RoomNumber,
    DateTime StartAt,
    DateTime EndAt,
    string Reason,
    string? Note,
    bool IsActive,
    string Version);

public sealed record RoomBlockWriteRequest(
    int RoomId,
    DateTime StartAt,
    DateTime EndAt,
    string Reason,
    string? Note,
    bool IsActive,
    string? Version);
