using Microsoft.AspNetCore.SignalR;

namespace HotelDigital.Api.Infrastructure.Realtime;

// Clients only receive invalidation notices; database reads remain the source of truth.
public sealed class UpdatesHub : Hub;

public interface IDataChangePublisher
{
    Task PublishAsync(CancellationToken cancellationToken);
}

public sealed class SignalRDataChangePublisher(IHubContext<UpdatesHub> hub) : IDataChangePublisher
{
    public Task PublishAsync(CancellationToken cancellationToken) =>
        hub.Clients.All.SendAsync("DataChanged", cancellationToken);
}
