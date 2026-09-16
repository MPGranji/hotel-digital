using System.Net.Mail;
using HotelDigital.Api.Infrastructure.Errors;

namespace HotelDigital.Api.Features.Customers;

public static class CustomerValidator
{
    public static void Validate(CustomerUpsertRequest request, bool requireVersion)
    {
        var errors = new Dictionary<string, string[]>();
        var fullName = request.FullName?.Trim();

        if (string.IsNullOrWhiteSpace(fullName))
            errors["fullName"] = ["Vui lòng nhập họ và tên khách hàng."];
        else if (fullName.Length > 150)
            errors["fullName"] = ["Họ và tên không được vượt quá 150 ký tự."];

        AddLengthError(errors, "phone", request.Phone, 40, "Số điện thoại");
        AddLengthError(errors, "email", request.Email, 254, "Email");
        AddLengthError(errors, "identityDocument", request.IdentityDocument, 60, "CCCD/Passport");
        AddLengthError(errors, "nationality", request.Nationality, 80, "Quốc tịch");
        AddLengthError(errors, "note", request.Note, 500, "Ghi chú");

        if (!string.IsNullOrWhiteSpace(request.Email) && !MailAddress.TryCreate(request.Email.Trim(), out _))
            errors["email"] = ["Email không đúng định dạng."];

        if (requireVersion && !TryDecodeVersion(request.Version, out _))
            errors["version"] = ["Phiên bản dữ liệu không hợp lệ. Vui lòng tải lại."];

        if (errors.Count > 0) throw new RequestValidationException(errors);
    }

    public static bool TryDecodeVersion(string? value, out byte[] version)
    {
        version = [];
        if (string.IsNullOrWhiteSpace(value)) return false;

        try
        {
            version = Convert.FromBase64String(value);
            return version.Length == 8;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static void AddLengthError(
        IDictionary<string, string[]> errors,
        string field,
        string? value,
        int maxLength,
        string label)
    {
        if (value?.Trim().Length > maxLength)
            errors[field] = [$"{label} không được vượt quá {maxLength} ký tự."];
    }
}
