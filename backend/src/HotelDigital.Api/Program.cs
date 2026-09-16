using HotelDigital.Api.Data;
using HotelDigital.Api.Features.Customers;
using HotelDigital.Api.Features.Bookings;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Authentication;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Web;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

var databaseConnectionString = builder.Configuration.GetConnectionString("HotelDatabase")
    ?? throw new InvalidOperationException("ConnectionStrings:HotelDatabase is not configured.");

if (databaseConnectionString.Contains(
        "Authentication=Active Directory Device Code Flow",
        StringComparison.OrdinalIgnoreCase))
{
    var deviceCodeProvider = new ActiveDirectoryAuthenticationProvider(deviceCodeResult =>
    {
        Console.WriteLine(deviceCodeResult.Message);
        return Task.CompletedTask;
    });

    SqlAuthenticationProvider.SetProvider(
        SqlAuthenticationMethod.ActiveDirectoryDeviceCodeFlow,
        deviceCodeProvider);
}

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
builder.Services.AddScoped<IAuditWriter, AuditWriter>();
builder.Services.AddScoped<ITransactionExecutor, TransactionExecutor>();
builder.Services.AddScoped<CustomerService>();
builder.Services.AddScoped<BookingQueryService>();
builder.Services.AddScoped<BookingCommandService>();
builder.Services.AddDbContext<HotelDbContext>(options =>
{
    options.UseAzureSql(databaseConnectionString);
});

var useDevelopmentUser = builder.Environment.IsDevelopment()
    && builder.Configuration.GetValue<bool>("Authentication:UseDevelopmentUser");

if (useDevelopmentUser)
{
    builder.Services
        .AddAuthentication(DevelopmentAuthenticationHandler.SchemeName)
        .AddScheme<DevelopmentAuthenticationOptions, DevelopmentAuthenticationHandler>(
            DevelopmentAuthenticationHandler.SchemeName,
            _ => { });
}
else
{
    builder.Services
        .AddAuthentication()
        .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));
}

builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build());

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
        }
    });
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthChecks("/health").AllowAnonymous();
app.MapGet("/health/database", async (
    HotelDbContext db,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    try
    {
        await db.Database.OpenConnectionAsync(cancellationToken);
        await db.Database.CloseConnectionAsync();
        return Results.Ok(new { status = "healthy" });
    }
    catch (Exception exception)
    {
        logger.LogError(exception, "Azure SQL health check failed.");
        return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
    }
}).AllowAnonymous();
app.MapGet("/api", () => Results.Ok(new
{
    service = "Hotel Digital API",
    status = "ready",
    version = "0.1.0"
}));
app.MapCustomerEndpoints();
app.MapBookingEndpoints();

app.Run();

public partial class Program;
