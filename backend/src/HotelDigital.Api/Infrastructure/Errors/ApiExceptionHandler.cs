using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace HotelDigital.Api.Infrastructure.Errors;

public sealed class ApiExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not ApiException apiException) return false;

        logger.LogWarning(
            "Request {TraceIdentifier} failed with business error {ErrorCode}",
            httpContext.TraceIdentifier,
            apiException.Code);

        httpContext.Response.StatusCode = apiException.StatusCode;
        var problem = new ProblemDetails
        {
            Status = apiException.StatusCode,
            Title = apiException.StatusCode switch
            {
                StatusCodes.Status400BadRequest => "Dữ liệu chưa hợp lệ",
                StatusCodes.Status404NotFound => "Không tìm thấy dữ liệu",
                StatusCodes.Status409Conflict => "Dữ liệu đã thay đổi",
                _ => "Không thể hoàn tất thao tác"
            },
            Detail = apiException.Message,
            Instance = httpContext.Request.Path
        };
        problem.Extensions["code"] = apiException.Code;
        problem.Extensions["traceId"] = httpContext.TraceIdentifier;

        if (apiException is RequestValidationException validationException)
        {
            problem.Extensions["errors"] = validationException.Errors;
        }

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
            Exception = exception
        });
    }
}
