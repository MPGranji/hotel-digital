using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using HotelDigital.Api.Infrastructure.Realtime;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace HotelDigital.Api.Tests;

public sealed class SmokeTests
{
    [Fact]
    public void Production_api_requires_authentication_configuration()
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("ConnectionStrings:HotelDatabase", "Server=localhost;Database=HotelDigitalAuthTest;Integrated Security=true;TrustServerCertificate=true");
            builder.UseSetting("Authentication:SigningSecret", "");
        });

        var error = Assert.Throws<InvalidOperationException>(() => factory.CreateClient());
        Assert.Contains("Authentication:SigningSecret", error.Message);
    }

    [Fact]
    public void Production_api_rejects_default_admin_password()
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("ConnectionStrings:HotelDatabase", "Server=localhost;Database=HotelDigitalAuthTest;Integrated Security=true;TrustServerCertificate=true");
            builder.UseSetting("Authentication:SigningSecret", TestSecret);
            builder.UseSetting("Authentication:AdminPassword", "admin");
        });

        var error = Assert.Throws<InvalidOperationException>(() => factory.CreateClient());
        Assert.Contains("Authentication:AdminPassword", error.Message);
    }

    [Fact]
    public async Task Production_api_rejects_anonymous_requests()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("ConnectionStrings:HotelDatabase", "Server=localhost;Database=HotelDigitalAuthTest;Integrated Security=true;TrustServerCertificate=true");
            builder.UseSetting("Authentication:SigningSecret", TestSecret);
            builder.UseSetting("Authentication:AdminPassword", "production-test-password");
        });
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/dashboard")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/health/database")).StatusCode);
    }

    [Fact]
    public async Task Realtime_hub_requires_authentication_in_production()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("ConnectionStrings:HotelDatabase", "Server=localhost;Database=HotelDigitalAuthTest;Integrated Security=true;TrustServerCertificate=true");
            builder.UseSetting("Authentication:SigningSecret", TestSecret);
            builder.UseSetting("Authentication:AdminPassword", "production-test-password");
        });
        using var client = factory.CreateClient();

        var response = await client.PostAsync("/hubs/updates/negotiate?negotiateVersion=1", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Admin_login_authenticates_api_and_realtime_hub()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.UseSetting("ConnectionStrings:HotelDatabase", "Server=localhost;Database=HotelDigitalAuthTest;Integrated Security=true;TrustServerCertificate=true");
            builder.UseSetting("Authentication:SigningSecret", TestSecret);
        });
        using var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PostAsJsonAsync("/api/auth/login", new { username = "admin", password = "wrong" })).StatusCode);
        var login = await client.PostAsJsonAsync("/api/auth/login", new { username = "admin", password = "admin" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var session = await login.Content.ReadFromJsonAsync<LoginResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session!.AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api")).StatusCode);
        var response = await client.PostAsync("/hubs/updates/negotiate?negotiateVersion=1", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Realtime_hub_broadcasts_to_all_connected_staff_sessions()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.UseSetting("ConnectionStrings:HotelDatabase", "Server=localhost;Database=HotelDigitalAuthTest;Integrated Security=true;TrustServerCertificate=true");
            builder.UseSetting("Authentication:SigningSecret", TestSecret);
        });

        using var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { username = "admin", password = "admin" });
        var token = (await login.Content.ReadFromJsonAsync<LoginResponse>())!.AccessToken;

        HubConnection Connect() => new HubConnectionBuilder()
            .WithUrl("http://localhost/hubs/updates", options =>
            {
                options.Transports = HttpTransportType.LongPolling;
                options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
                options.AccessTokenProvider = () => Task.FromResult(token)!;
            })
            .Build();

        await using var first = Connect();
        await using var second = Connect();
        var firstReceived = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var secondReceived = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        first.On("DataChanged", () => firstReceived.TrySetResult());
        second.On("DataChanged", () => secondReceived.TrySetResult());

        await Task.WhenAll(first.StartAsync(), second.StartAsync());
        await factory.Services.GetRequiredService<IDataChangePublisher>().PublishAsync(CancellationToken.None);

        await Task.WhenAll(firstReceived.Task, secondReceived.Task).WaitAsync(TimeSpan.FromSeconds(5));
    }

    private const string TestSecret = "test-only-signing-secret-longer-than-32-bytes";
    private sealed record LoginResponse(string AccessToken, string DisplayName);
}
