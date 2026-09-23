using System.Globalization;

namespace HotelDigital.Api.Features.Dashboard;

public static class DashboardEndpoints
{
    public static IEndpointRouteBuilder MapDashboardEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/dashboard", async (
            string? month,
            DashboardQueryService service,
            CancellationToken cancellationToken) =>
        {
            DateTime? selectedMonth = null;
            if (month is not null)
            {
                if (!DateTime.TryParseExact(month, "yyyy-MM", CultureInfo.InvariantCulture,
                        DateTimeStyles.None, out var parsed))
                    return Results.BadRequest(new { message = "Tháng phải có dạng YYYY-MM." });
                selectedMonth = parsed;
            }

            return Results.Ok(await service.GetAsync(selectedMonth, cancellationToken));
        }).WithTags("Dashboard");
        return endpoints;
    }
}
