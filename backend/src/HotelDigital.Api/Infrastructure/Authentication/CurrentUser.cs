using System.Security.Claims;

namespace HotelDigital.Api.Infrastructure.Authentication;

public interface ICurrentUser
{
    string ObjectId { get; }
    string? DisplayName { get; }
    string? Email { get; }
    string? Role { get; }
}

public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal Principal => accessor.HttpContext?.User
        ?? throw new InvalidOperationException("Không tìm thấy người dùng trong request hiện tại.");

    public string ObjectId => Principal.FindFirstValue("oid")
        ?? Principal.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("Access token không có Object ID.");

    public string? DisplayName => Principal.FindFirstValue("name") ?? Principal.Identity?.Name;

    public string? Email => Principal.FindFirstValue("preferred_username")
        ?? Principal.FindFirstValue(ClaimTypes.Email);

    public string? Role => Principal.FindFirstValue(ClaimTypes.Role) ?? Principal.FindFirstValue("roles");
}
