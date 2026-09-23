using System.Net;
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
            builder.UseSetting("Authentication:TenantId", "");
            builder.UseSetting("Authentication:Audience", "");
            builder.UseSetting("Authentication:RequiredRole", "");
            builder.UseSetting("DevelopmentAuthentication:Enabled", "true");
        });

        var error = Assert.Throws<InvalidOperationException>(() => factory.CreateClient());
        Assert.Contains("Production authentication requires", error.Message);
    }

    [Fact]
    public async Task Production_api_rejects_anonymous_requests()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("ConnectionStrings:HotelDatabase", "Server=localhost;Database=HotelDigitalAuthTest;Integrated Security=true;TrustServerCertificate=true");
            builder.UseSetting("Authentication:TenantId", "11111111-1111-1111-1111-111111111111");
            builder.UseSetting("Authentication:Audience", "api://hotel-digital-test");
            builder.UseSetting("Authentication:RequiredRole", "Hotel.Staff");
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
            builder.UseSetting("Authentication:TenantId", "11111111-1111-1111-1111-111111111111");
            builder.UseSetting("Authentication:Audience", "api://hotel-digital-test");
            builder.UseSetting("Authentication:RequiredRole", "Hotel.Staff");
        });
        using var client = factory.CreateClient();

        var response = await client.PostAsync("/hubs/updates/negotiate?negotiateVersion=1", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Realtime_hub_negotiates_with_local_development_authentication()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");
            builder.UseSetting("ConnectionStrings:HotelDatabase", "Server=localhost;Database=HotelDigitalAuthTest;Integrated Security=true;TrustServerCertificate=true");
            builder.UseSetting("DevelopmentAuthentication:Enabled", "true");
        });
        using var client = factory.CreateClient();

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
            builder.UseSetting("DevelopmentAuthentication:Enabled", "true");
        });

        HubConnection Connect() => new HubConnectionBuilder()
            .WithUrl("http://localhost/hubs/updates", options =>
            {
                options.Transports = HttpTransportType.LongPolling;
                options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
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
}
