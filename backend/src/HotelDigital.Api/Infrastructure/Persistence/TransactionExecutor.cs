using HotelDigital.Api.Data;
using HotelDigital.Api.Infrastructure.Realtime;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Infrastructure.Persistence;

public interface ITransactionExecutor
{
    Task<T> ExecuteAsync<T>(Func<CancellationToken, Task<T>> operation, CancellationToken cancellationToken);
}

public sealed class TransactionExecutor(
    HotelDbContext db,
    IDataChangePublisher publisher,
    ILogger<TransactionExecutor> logger) : ITransactionExecutor
{
    public async Task<T> ExecuteAsync<T>(
        Func<CancellationToken, Task<T>> operation,
        CancellationToken cancellationToken)
    {
        var strategy = db.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            var result = await operation(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            try
            {
                using var notificationTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                await publisher.PublishAsync(notificationTimeout.Token);
            }
            catch (Exception exception)
            {
                // The write already committed. A notification failure must not make the caller retry it.
                logger.LogWarning(exception, "Realtime notification failed after a committed transaction.");
            }
            return result;
        });
    }
}
