namespace HotelDigital.Api.Features.Rooms;

public sealed record RoomListItem(
    int Id,
    string RoomNumber,
    string RoomTypeCode,
    string RoomTypeName,
    string? FloorLabel,
    decimal? ListedPricePerNight,
    string Status,
    long? CurrentBookingId,
    string? CurrentBookingCode,
    string? CurrentGuestName,
    DateTime? NextCheckInAt);
