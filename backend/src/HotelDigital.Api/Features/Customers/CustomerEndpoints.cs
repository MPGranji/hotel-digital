namespace HotelDigital.Api.Features.Customers;

public static class CustomerEndpoints
{
    public static IEndpointRouteBuilder MapCustomerEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/customers").WithTags("Customers");

        group.MapGet("/", (
            string? search,
            bool? isActive,
            int page,
            int pageSize,
            CustomerService service,
            CancellationToken cancellationToken) =>
            service.GetPageAsync(search, isActive, page, pageSize, cancellationToken));

        group.MapPost("/duplicates", (CustomerDuplicateRequest request, CustomerService service, CancellationToken cancellationToken) =>
            service.FindDuplicatesAsync(request, cancellationToken));

        group.MapGet("/{id:long}", (long id, CustomerService service, CancellationToken cancellationToken) =>
            service.GetAsync(id, cancellationToken));

        group.MapGet("/{id:long}/stays", (long id, CustomerService service, CancellationToken cancellationToken) =>
            service.GetStaysAsync(id, cancellationToken));

        group.MapPost("/", async (
            CustomerUpsertRequest request,
            CustomerService service,
            CancellationToken cancellationToken) =>
        {
            var customer = await service.CreateAsync(request, cancellationToken);
            return Results.Created($"/api/customers/{customer.Id}", customer);
        });

        group.MapPut("/{id:long}", (
            long id,
            CustomerUpsertRequest request,
            CustomerService service,
            CancellationToken cancellationToken) =>
            service.UpdateAsync(id, request, cancellationToken));

        group.MapPost("/{id:long}/merge", (
            long id,
            CustomerMergeRequest request,
            CustomerService service,
            CancellationToken cancellationToken) =>
            service.MergeAsync(id, request.DuplicateCustomerId, cancellationToken));

        return endpoints;
    }
}
