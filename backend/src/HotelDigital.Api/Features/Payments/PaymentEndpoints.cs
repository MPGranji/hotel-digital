namespace HotelDigital.Api.Features.Payments;

public static class PaymentEndpoints
{
    public static IEndpointRouteBuilder MapPaymentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/bookings/{bookingId:long}/payments").WithTags("Payments");
        group.MapGet("/", (long bookingId, PaymentService service, CancellationToken token) =>
            service.GetAsync(bookingId, token));
        group.MapPost("/", async (long bookingId, PaymentWriteRequest request, PaymentService service, CancellationToken token) =>
        {
            var payment = await service.CreateAsync(bookingId, request, token);
            return Results.Created($"/api/bookings/{bookingId}/payments/{payment.Id}", payment);
        });
        return endpoints;
    }
}
