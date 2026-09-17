namespace HotelDigital.Api.Features.Channels;

public static class ChannelEndpoints
{
    public static IEndpointRouteBuilder MapChannelEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/channels").WithTags("Channels");
        group.MapGet("/", (
            string? search,
            string? category,
            bool? isActive,
            ChannelService service,
            CancellationToken cancellationToken) =>
            service.GetAsync(search, category, isActive, cancellationToken));
        group.MapPost("/", async (
            ChannelWriteRequest request,
            ChannelService service,
            CancellationToken cancellationToken) =>
        {
            var channel = await service.CreateAsync(request, cancellationToken);
            return Results.Created($"/api/channels/{channel.Id}", channel);
        });
        group.MapPut("/{id:int}", (
            int id,
            ChannelWriteRequest request,
            ChannelService service,
            CancellationToken cancellationToken) =>
            service.UpdateAsync(id, request, cancellationToken));
        return endpoints;
    }
}
