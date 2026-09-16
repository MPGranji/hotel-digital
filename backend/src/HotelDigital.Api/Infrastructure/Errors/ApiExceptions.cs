namespace HotelDigital.Api.Infrastructure.Errors;

public class ApiException(int statusCode, string code, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;
}

public sealed class ResourceNotFoundException(string code, string message)
    : ApiException(StatusCodes.Status404NotFound, code, message);

public sealed class BusinessRuleException(string code, string message)
    : ApiException(StatusCodes.Status422UnprocessableEntity, code, message);

public sealed class ConflictException(string code, string message)
    : ApiException(StatusCodes.Status409Conflict, code, message);

public sealed class RequestValidationException(IReadOnlyDictionary<string, string[]> errors)
    : ApiException(StatusCodes.Status400BadRequest, "validation_failed", "Dữ liệu gửi lên chưa hợp lệ.")
{
    public IReadOnlyDictionary<string, string[]> Errors { get; } = errors;
}
