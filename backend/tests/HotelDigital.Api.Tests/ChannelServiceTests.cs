using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Features.Channels;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HotelDigital.Api.Tests;

public sealed class ChannelServiceTests
{
    [Fact]
    public async Task Channel_with_bookings_keeps_its_reporting_identity()
    {
        var options = new DbContextOptionsBuilder<HotelDbContext>()
            .UseInMemoryDatabase($"channel-history-{Guid.NewGuid():N}").Options;
        await using var db = new HotelDbContext(options);
        db.Channels.Add(new Channel { ChannelId = 1, Code = "DIRECT", Name = "Trực tiếp", Category = "OFFLINE", IsActive = true });
        db.Bookings.Add(new Booking { BookingId = 1, ChannelId = 1 });
        await db.SaveChangesAsync();
        var service = new ChannelService(db, new NoopAuditWriter(), new InlineTransactionExecutor());

        var error = await Assert.ThrowsAsync<BusinessRuleException>(() => service.UpdateAsync(
            1, new ChannelWriteRequest("DIRECT", "Trực tiếp", "ONLINE", true, null), CancellationToken.None));

        Assert.Equal("channel_identity_has_history", error.Code);
        Assert.Equal("OFFLINE", db.Channels.Single().Category);
    }

    private sealed class NoopAuditWriter : IAuditWriter
    {
        public void Add(string action, string entityType, string entityId, object changes) { }
    }

    private sealed class InlineTransactionExecutor : ITransactionExecutor
    {
        public Task<T> ExecuteAsync<T>(Func<CancellationToken, Task<T>> operation, CancellationToken cancellationToken) =>
            operation(cancellationToken);
    }
}
