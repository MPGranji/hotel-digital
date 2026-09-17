namespace HotelDigital.Api.Features.Invoices;

public static class InvoiceEndpoints
{
    public static IEndpointRouteBuilder MapInvoiceEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/invoices").WithTags("Invoices");
        group.MapGet("/", (string? search, string? status, InvoiceService service, CancellationToken token) => service.GetAsync(search, status, token));
        group.MapPost("/", async (InvoiceWriteRequest request, InvoiceService service, CancellationToken token) =>
        {
            var invoice = await service.CreateAsync(request, token);
            return Results.Created($"/api/invoices/{invoice.Id}", invoice);
        });
        group.MapPut("/{id:long}", (long id, InvoiceWriteRequest request, InvoiceService service, CancellationToken token) => service.UpdateAsync(id, request, token));
        return endpoints;
    }
}
