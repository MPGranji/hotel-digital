using HotelDigital.Api.Data;
using HotelDigital.Api.Features.Customers;
using HotelDigital.Api.Features.Bookings;
using HotelDigital.Api.Features.Rooms;
using HotelDigital.Api.Features.Channels;
using HotelDigital.Api.Features.Invoices;
using HotelDigital.Api.Features.Payments;
using HotelDigital.Api.Features.Dashboard;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Authentication;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using HotelDigital.Api.Infrastructure.Realtime;
using Microsoft.AspNetCore.Authentication.JwtBearer;
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
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
builder.Services.AddScoped<IAuditWriter, AuditWriter>();
builder.Services.AddScoped<ITransactionExecutor, TransactionExecutor>();
builder.Services.AddSingleton<IDataChangePublisher, SignalRDataChangePublisher>();
builder.Services.AddScoped<CustomerService>();
builder.Services.AddScoped<BookingQueryService>();
builder.Services.AddScoped<BookingCommandService>();
builder.Services.AddScoped<RoomService>();
builder.Services.AddScoped<RoomCalendarService>();
builder.Services.AddScoped<RoomRateService>();
builder.Services.AddScoped<ChannelService>();
builder.Services.AddScoped<InvoiceService>();
builder.Services.AddScoped<InvoiceLifecycleService>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<DashboardQueryService>();
builder.Services.AddDbContext<HotelDbContext>(options =>
{
    options.UseAzureSql(databaseConnectionString);
});
var signalR = builder.Services.AddSignalR();
if (!string.IsNullOrWhiteSpace(builder.Configuration["Azure:SignalR:ConnectionString"]))
    signalR.AddAzureSignalR();

var authorizationPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
    .RequireAuthenticatedUser();
if (builder.Environment.IsDevelopment()
    && builder.Configuration.GetValue<bool>("DevelopmentAuthentication:Enabled"))
{
    builder.Services
        .AddAuthentication(DevelopmentAuthenticationHandler.SchemeName)
        .AddScheme<DevelopmentAuthenticationOptions, DevelopmentAuthenticationHandler>(
            DevelopmentAuthenticationHandler.SchemeName, _ => { });
}
else
{
    var tenantId = builder.Configuration["Authentication:TenantId"];
    var audience = builder.Configuration["Authentication:Audience"];
    var requiredRole = builder.Configuration["Authentication:RequiredRole"];
    if (string.IsNullOrWhiteSpace(tenantId) || !Guid.TryParse(tenantId, out _)
        || string.IsNullOrWhiteSpace(audience) || string.IsNullOrWhiteSpace(requiredRole))
        throw new InvalidOperationException("Production authentication requires TenantId, Audience and RequiredRole.");

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.Authority = $"https://login.microsoftonline.com/{tenantId}/v2.0";
            options.Audience = audience;
            options.MapInboundClaims = false;
            options.TokenValidationParameters.NameClaimType = "name";
            options.TokenValidationParameters.RoleClaimType = "roles";
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    if (context.Request.Path.StartsWithSegments("/hubs/updates")
                        && !string.IsNullOrEmpty(context.Request.Query["access_token"]))
                        context.Token = context.Request.Query["access_token"];
                    return Task.CompletedTask;
                }
            };
        });
    authorizationPolicy.RequireRole(requiredRole);
}

builder.Services.AddAuthorizationBuilder().SetFallbackPolicy(authorizationPolicy.Build());

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
        }
    });
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseHttpsRedirection();
if (allowedOrigins.Length > 0)
{
    var webSocketOptions = new WebSocketOptions();
    foreach (var origin in allowedOrigins) webSocketOptions.AllowedOrigins.Add(origin);
    app.UseWebSockets(webSocketOptions);
}
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthChecks("/health").AllowAnonymous();
app.MapHub<UpdatesHub>("/hubs/updates", options => options.CloseOnAuthenticationExpiration = true)
    .RequireAuthorization();
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
app.MapCustomerEndpoints();
app.MapBookingEndpoints();
app.MapRoomEndpoints();
app.MapChannelEndpoints();
app.MapInvoiceEndpoints();
app.MapPaymentEndpoints();
app.MapDashboardEndpoints();

app.Run();

public partial class Program;
