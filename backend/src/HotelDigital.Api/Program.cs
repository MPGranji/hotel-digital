using HotelDigital.Api.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

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
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();
builder.Services.AddDbContext<HotelDbContext>(options =>
{
    options.UseAzureSql(databaseConnectionString);
});

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

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthChecks("/health");
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
});
app.MapGet("/api", () => Results.Ok(new
{
    service = "Hotel Digital API",
    status = "ready",
    version = "0.1.0"
}));

app.Run();

public partial class Program;
