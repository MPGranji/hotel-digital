using System.Text.Json;
using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Infrastructure.Authentication;

namespace HotelDigital.Api.Infrastructure.Auditing;

public interface IAuditWriter
{
    void Add(string action, string entityType, string entityId, object changes);
}

public sealed class AuditWriter(
    HotelDbContext db,
    ICurrentUser currentUser,
    IHttpContextAccessor httpContextAccessor) : IAuditWriter
{
    public void Add(string action, string entityType, string entityId, object changes)
    {
        db.AuditLogs.Add(new AuditLog
        {
            OccurredAtUtc = DateTime.UtcNow,
            ActorObjectId = currentUser.ObjectId,
            ActorDisplayName = currentUser.DisplayName,
            ActorEmail = currentUser.Email,
            ActorRole = currentUser.Role,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            ChangesJson = JsonSerializer.Serialize(changes),
            CorrelationId = httpContextAccessor.HttpContext?.TraceIdentifier ?? Guid.NewGuid().ToString("N")
        });
    }
}
