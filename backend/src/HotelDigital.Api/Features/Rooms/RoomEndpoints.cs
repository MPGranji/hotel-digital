namespace HotelDigital.Api.Features.Rooms;

public static class RoomEndpoints
{
    public static IEndpointRouteBuilder MapRoomEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/rooms", (
            string? search,
            string? status,
            RoomService service,
            CancellationToken cancellationToken) =>
            service.GetAsync(search, status, cancellationToken))
            .WithTags("Rooms");
        return endpoints;
    }
}
