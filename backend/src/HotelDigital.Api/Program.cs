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
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

var databaseConnectionString = builder.Configuration.GetConnectionString("HotelDatabase")
    ?? throw new InvalidOperationException("ConnectionStrings:HotelDatabase is not configured.");
var databaseConnection = new SqlConnectionStringBuilder(databaseConnectionString);
// Serverless Azure SQL can take about a minute to resume after being idle.
databaseConnection.ConnectTimeout = Math.Max(databaseConnection.ConnectTimeout, 60);
databaseConnectionString = databaseConnection.ConnectionString;

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
var signingSecret = builder.Configuration["Authentication:SigningSecret"];
if (string.IsNullOrWhiteSpace(signingSecret) || Encoding.UTF8.GetByteCount(signingSecret) < 32)
    throw new InvalidOperationException("Authentication:SigningSecret must contain at least 32 UTF-8 bytes.");
var adminPassword = builder.Configuration["Authentication:AdminPassword"];
if (string.IsNullOrWhiteSpace(adminPassword)
    || (!builder.Environment.IsDevelopment() && adminPassword == "admin"))
    throw new InvalidOperationException("Authentication:AdminPassword must be set to a non-default password outside Development.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
.AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = "hotel-digital",
        ValidateAudience = true,
        ValidAudience = "hotel-digital-web",
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingSecret)),
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(1),
        NameClaimType = "name"
    };
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

builder.Services.AddAuthorizationBuilder().SetFallbackPolicy(authorizationPolicy.Build());
builder.Services.AddRateLimiter(options => options.AddPolicy("login", context =>
    RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        })));

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
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthChecks("/health").AllowAnonymous();
app.MapPost("/api/auth/login", (LoginRequest request) =>
{
    var validUser = FixedTimeEquals(request.Username, "admin");
    var validPassword = FixedTimeEquals(request.Password, adminPassword);
    if (!validUser || !validPassword) return Results.Unauthorized();

    var expires = DateTime.UtcNow.AddHours(8);
    var token = new JwtSecurityToken(
        issuer: "hotel-digital",
        audience: "hotel-digital-web",
        claims: [new Claim("oid", "admin"), new Claim("name", "Quản trị viên"), new Claim("preferred_username", "admin")],
        expires: expires,
        signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingSecret)), SecurityAlgorithms.HmacSha256));
    return Results.Ok(new { accessToken = new JwtSecurityTokenHandler().WriteToken(token), displayName = "Quản trị viên" });
}).AllowAnonymous().RequireRateLimiting("login");
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

static bool FixedTimeEquals(string? supplied, string expected)
{
    var left = SHA256.HashData(Encoding.UTF8.GetBytes(supplied ?? ""));
    var right = SHA256.HashData(Encoding.UTF8.GetBytes(expected));
    return CryptographicOperations.FixedTimeEquals(left, right);
}

public sealed record LoginRequest(string? Username, string? Password);

public partial class Program;
