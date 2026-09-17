using HotelDigital.Api.Data;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Features.Channels;

public sealed class ChannelService(
    HotelDbContext db,
    IAuditWriter auditWriter,
    ITransactionExecutor transactionExecutor)
{
    public async Task<IReadOnlyList<ChannelItem>> GetAsync(
        string? search,
        string? category,
        bool? isActive,
        CancellationToken cancellationToken)
    {
        var query = db.Channels.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => x.Code.Contains(term) || x.Name.Contains(term));
        }
        if (!string.IsNullOrWhiteSpace(category))
        {
            var normalizedCategory = category.Trim().ToUpperInvariant();
            query = query.Where(x => x.Category == normalizedCategory);
        }
        if (isActive.HasValue) query = query.Where(x => x.IsActive == isActive.Value);

        return await query
            .OrderBy(x => x.Category)
            .ThenBy(x => x.Name)
            .Select(x => new ChannelItem(
                x.ChannelId,
                x.Code,
                x.Name,
                x.Category,
                x.IsActive,
                x.Note,
                x.Bookings.Count))
            .ToListAsync(cancellationToken);
    }

    public async Task<ChannelItem> CreateAsync(
        ChannelWriteRequest request,
        CancellationToken cancellationToken)
    {
        ChannelValidator.Validate(request);
        return await transactionExecutor.ExecuteAsync(async token =>
        {
            var code = request.Code.Trim().ToUpperInvariant();
            await EnsureUniqueCodeAsync(code, null, token);
            var channel = new Data.Entities.Channel
            {
                Code = code,
                Name = request.Name.Trim(),
                Category = request.Category.Trim().ToUpperInvariant(),
                IsActive = request.IsActive,
                Note = Clean(request.Note)
            };
            db.Channels.Add(channel);
            await SaveAsync(token);
            auditWriter.Add("CREATE", "Channel", channel.ChannelId.ToString(), new
            {
                channel.Code,
                channel.Name,
                channel.Category,
                channel.IsActive
            });
            await db.SaveChangesAsync(token);
            return ToItem(channel, 0);
        }, cancellationToken);
    }

    public async Task<ChannelItem> UpdateAsync(
        int id,
        ChannelWriteRequest request,
        CancellationToken cancellationToken)
    {
        ChannelValidator.Validate(request);
        return await transactionExecutor.ExecuteAsync(async token =>
        {
            var channel = await db.Channels.SingleOrDefaultAsync(x => x.ChannelId == id, token)
                ?? throw new ResourceNotFoundException("channel_not_found", "Không tìm thấy kênh đặt phòng.");
            var code = request.Code.Trim().ToUpperInvariant();
            await EnsureUniqueCodeAsync(code, id, token);
            var changedFields = GetChangedFields(channel, request, code);
            channel.Code = code;
            channel.Name = request.Name.Trim();
            channel.Category = request.Category.Trim().ToUpperInvariant();
            channel.IsActive = request.IsActive;
            channel.Note = Clean(request.Note);
            auditWriter.Add("UPDATE", "Channel", channel.ChannelId.ToString(), new { fields = changedFields });
            await SaveAsync(token);
            var bookingCount = await db.Bookings.CountAsync(x => x.ChannelId == id, token);
            return ToItem(channel, bookingCount);
        }, cancellationToken);
    }

    private async Task EnsureUniqueCodeAsync(string code, int? excludeId, CancellationToken cancellationToken)
    {
        if (await db.Channels.AsNoTracking().AnyAsync(
            x => x.Code == code && x.ChannelId != excludeId,
            cancellationToken))
        {
            throw new ConflictException("channel_code_exists", "Mã kênh đã được sử dụng.");
        }
    }

    private async Task SaveAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (FindSqlException(exception)?.Number is 2601 or 2627)
        {
            throw new ConflictException("channel_code_exists", "Mã kênh đã được sử dụng.");
        }
    }

    private static string[] GetChangedFields(
        Data.Entities.Channel channel,
        ChannelWriteRequest request,
        string normalizedCode)
    {
        var fields = new List<string>();
        if (channel.Code != normalizedCode) fields.Add("Code");
        if (channel.Name != request.Name.Trim()) fields.Add("Name");
        if (channel.Category != request.Category.Trim().ToUpperInvariant()) fields.Add("Category");
        if (channel.IsActive != request.IsActive) fields.Add("IsActive");
        if (channel.Note != Clean(request.Note)) fields.Add("Note");
        return [.. fields];
    }

    private static ChannelItem ToItem(Data.Entities.Channel channel, int bookingCount) => new(
        channel.ChannelId,
        channel.Code,
        channel.Name,
        channel.Category,
        channel.IsActive,
        channel.Note,
        bookingCount);

    private static SqlException? FindSqlException(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
            if (current is SqlException sqlException) return sqlException;
        return null;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
