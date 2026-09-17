namespace HotelDigital.Api.Features.Rooms;

public static class RoomEndpoints
{
    public static IEndpointRouteBuilder MapRoomEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var rooms = endpoints.MapGroup("/api/rooms").WithTags("Rooms");
        rooms.MapGet("/", (
            string? search,
            string? status,
            RoomService service,
            CancellationToken cancellationToken) =>
            service.GetAsync(search, status, cancellationToken));
        rooms.MapPost("/", async (RoomWriteRequest request, RoomService service, CancellationToken cancellationToken) =>
        {
            var room = await service.CreateRoomAsync(request, cancellationToken);
            return Results.Created($"/api/rooms/{room.Id}", room);
        });
        rooms.MapPut("/{id:int}", (int id, RoomWriteRequest request, RoomService service, CancellationToken cancellationToken) =>
            service.UpdateRoomAsync(id, request, cancellationToken));
        rooms.MapGet("/calendar", (DateOnly dateFrom, int days, RoomCalendarService service, CancellationToken cancellationToken) =>
            service.GetAsync(dateFrom, days, cancellationToken));
        rooms.MapGet("/hourly-calendar", (int roomId, DateOnly weekStart, RoomCalendarService service, CancellationToken cancellationToken) =>
            service.GetHourlyAsync(roomId, weekStart, cancellationToken));

        var roomBlocks = endpoints.MapGroup("/api/room-blocks").WithTags("Room maintenance");
        roomBlocks.MapGet("/{id:long}", (long id, RoomCalendarService service, CancellationToken cancellationToken) =>
            service.GetBlockAsync(id, cancellationToken));
        roomBlocks.MapPost("/", async (RoomBlockWriteRequest request, RoomCalendarService service, CancellationToken cancellationToken) =>
        {
            var block = await service.CreateBlockAsync(request, cancellationToken);
            return Results.Created($"/api/room-blocks/{block.Id}", block);
        });
        roomBlocks.MapPut("/{id:long}", (long id, RoomBlockWriteRequest request, RoomCalendarService service, CancellationToken cancellationToken) =>
            service.UpdateBlockAsync(id, request, cancellationToken));

        var roomTypes = endpoints.MapGroup("/api/room-types").WithTags("Room types");
        roomTypes.MapGet("/", (bool? isActive, RoomService service, CancellationToken cancellationToken) =>
            service.GetRoomTypesAsync(isActive, cancellationToken));
        roomTypes.MapPost("/", async (RoomTypeWriteRequest request, RoomService service, CancellationToken cancellationToken) =>
        {
            var roomType = await service.CreateRoomTypeAsync(request, cancellationToken);
            return Results.Created($"/api/room-types/{roomType.Id}", roomType);
        });
        roomTypes.MapPut("/{id:int}", (int id, RoomTypeWriteRequest request, RoomService service, CancellationToken cancellationToken) =>
            service.UpdateRoomTypeAsync(id, request, cancellationToken));

        var roomRates = endpoints.MapGroup("/api/room-rates").WithTags("Room rates");
        roomRates.MapGet("/", (int? roomTypeId, bool? isActive, RoomRateService service, CancellationToken cancellationToken) =>
            service.GetAsync(roomTypeId, isActive, cancellationToken));
        roomRates.MapGet("/{id:long}", (long id, RoomRateService service, CancellationToken cancellationToken) =>
            service.GetOneAsync(id, cancellationToken));
        roomRates.MapGet("/{id:long}/history", (long id, RoomRateService service, CancellationToken cancellationToken) =>
            service.GetHistoryAsync(id, cancellationToken));
        roomRates.MapPost("/", async (RoomRateWriteRequest request, RoomRateService service, CancellationToken cancellationToken) =>
        {
            var rate = await service.CreateAsync(request, cancellationToken);
            return Results.Created($"/api/room-rates/{rate.Id}", rate);
        });
        roomRates.MapPut("/{id:long}", (long id, RoomRateWriteRequest request, RoomRateService service, CancellationToken cancellationToken) =>
            service.UpdateAsync(id, request, cancellationToken));
        return endpoints;
    }
}
