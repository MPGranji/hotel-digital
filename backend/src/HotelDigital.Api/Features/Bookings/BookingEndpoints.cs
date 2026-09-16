namespace HotelDigital.Api.Features.Bookings;

public static class BookingEndpoints
{
    public static IEndpointRouteBuilder MapBookingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/bookings").WithTags("Bookings");

        group.MapGet("/", (
            DateTime? dateFrom,
            DateTime? dateTo,
            int? roomId,
            int? roomTypeId,
            int? channelId,
            string? status,
            string? paymentStatus,
            string? search,
            int page,
            int pageSize,
            BookingQueryService service,
            CancellationToken cancellationToken) =>
            service.GetPageAsync(
                dateFrom,
                dateTo,
                roomId,
                roomTypeId,
                channelId,
                status,
                paymentStatus,
                search,
                page,
                pageSize,
                cancellationToken));

        group.MapGet("/options", (BookingQueryService service, CancellationToken cancellationToken) =>
            service.GetOptionsAsync(cancellationToken));

        group.MapGet("/availability", (
            DateTime checkInAt,
            DateTime checkOutAt,
            long? excludeBookingId,
            BookingQueryService service,
            CancellationToken cancellationToken) =>
            service.GetAvailableRoomIdsAsync(checkInAt, checkOutAt, excludeBookingId, cancellationToken));

        group.MapGet("/{id:long}", (long id, BookingQueryService service, CancellationToken cancellationToken) =>
            service.GetAsync(id, cancellationToken));

        group.MapPost("/", async (
            BookingWriteRequest request,
            BookingCommandService commands,
            BookingQueryService queries,
            CancellationToken cancellationToken) =>
        {
            var id = await commands.CreateAsync(request, cancellationToken);
            var booking = await queries.GetAsync(id, cancellationToken);
            return Results.Created($"/api/bookings/{id}", booking);
        });

        group.MapPut("/{id:long}", async (
            long id,
            BookingWriteRequest request,
            BookingCommandService commands,
            BookingQueryService queries,
            CancellationToken cancellationToken) =>
        {
            await commands.UpdateAsync(id, request, cancellationToken);
            return await queries.GetAsync(id, cancellationToken);
        });

        MapStatusEndpoint(group, "check-in", "CHECKED_IN");
        MapStatusEndpoint(group, "check-out", "CHECKED_OUT");
        MapStatusEndpoint(group, "cancel", "CANCELLED");
        MapStatusEndpoint(group, "no-show", "NO_SHOW");
        return endpoints;
    }

    private static void MapStatusEndpoint(RouteGroupBuilder group, string route, string targetStatus)
    {
        group.MapPost($"/{{id:long}}/{route}", async (
            long id,
            BookingStatusRequest request,
            BookingCommandService commands,
            BookingQueryService queries,
            CancellationToken cancellationToken) =>
        {
            await commands.ChangeStatusAsync(id, targetStatus, request, cancellationToken);
            return await queries.GetAsync(id, cancellationToken);
        });
    }
}
