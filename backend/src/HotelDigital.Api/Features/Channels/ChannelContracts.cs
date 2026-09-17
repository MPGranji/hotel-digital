namespace HotelDigital.Api.Features.Channels;

public sealed record ChannelItem(
    int Id,
    string Code,
    string Name,
    string Category,
    bool IsActive,
    string? Note,
    int BookingCount);

public sealed record ChannelWriteRequest(
    string Code,
    string Name,
    string Category,
    bool IsActive,
    string? Note);
