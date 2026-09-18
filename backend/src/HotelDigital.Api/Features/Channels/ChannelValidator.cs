using HotelDigital.Api.Infrastructure.Errors;

namespace HotelDigital.Api.Features.Channels;

public static class ChannelValidator
{
    private static readonly HashSet<string> Categories =
        ["OFFLINE", "ONLINE", "TRAVEL_AGENCY"];

    public static void Validate(ChannelWriteRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        var code = request.Code?.Trim();
        var name = request.Name?.Trim();
        var category = request.Category?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(code)) errors["code"] = ["Vui lòng nhập mã kênh."];
        else if (code.Length > 40) errors["code"] = ["Mã kênh không được vượt quá 40 ký tự."];
        if (string.IsNullOrWhiteSpace(name)) errors["name"] = ["Vui lòng nhập tên kênh."];
        else if (name.Length > 100) errors["name"] = ["Tên kênh không được vượt quá 100 ký tự."];
        if (string.IsNullOrWhiteSpace(category) || !Categories.Contains(category))
            errors["category"] = ["Nhóm kênh không hợp lệ."];
        if (request.Note?.Trim().Length > 300) errors["note"] = ["Ghi chú không được vượt quá 300 ký tự."];
        if (errors.Count > 0) throw new RequestValidationException(errors);
    }
}
