using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace HotelDigital.Api.Infrastructure.Authentication;

public sealed class DevelopmentAuthenticationOptions : AuthenticationSchemeOptions;

public sealed class DevelopmentAuthenticationHandler(
    IOptionsMonitor<DevelopmentAuthenticationOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<DevelopmentAuthenticationOptions>(options, logger, encoder)
{
    public const string SchemeName = "Development";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var identity = new ClaimsIdentity(
        [
            new Claim("oid", "local-development-user"),
            new Claim("name", "Người dùng phát triển"),
            new Claim("preferred_username", "developer@local")
        ], SchemeName);

        return Task.FromResult(AuthenticateResult.Success(
            new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }
}
