using HotelDigital.Api.Infrastructure.Errors;

namespace HotelDigital.Api.Features.Rooms;

public static class RoomValidator
{
    public static void Validate(RoomWriteRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.RoomNumber)) errors["roomNumber"] = ["Vui lòng nhập số phòng."];
        else if (request.RoomNumber.Trim().Length > 20) errors["roomNumber"] = ["Số phòng tối đa 20 ký tự."];
        if (request.RoomTypeId <= 0) errors["roomTypeId"] = ["Vui lòng chọn hạng phòng."];
        if (request.FloorLabel?.Trim().Length > 20) errors["floorLabel"] = ["Tên tầng tối đa 20 ký tự."];
        if (request.Note?.Trim().Length > 500) errors["note"] = ["Ghi chú tối đa 500 ký tự."];
        if (errors.Count > 0) throw new RequestValidationException(errors);
    }

    public static void Validate(RoomTypeWriteRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.Code)) errors["code"] = ["Vui lòng nhập mã hạng phòng."];
        else if (request.Code.Trim().Length > 30) errors["code"] = ["Mã hạng phòng tối đa 30 ký tự."];
        if (string.IsNullOrWhiteSpace(request.Name)) errors["name"] = ["Vui lòng nhập tên hạng phòng."];
        else if (request.Name.Trim().Length > 100) errors["name"] = ["Tên hạng phòng tối đa 100 ký tự."];
        if (request.Capacity <= 0) errors["capacity"] = ["Sức chứa phải lớn hơn 0."];
        if (request.ListedPricePerNight < 0) errors["listedPricePerNight"] = ["Giá niêm yết không được âm."];
        if (errors.Count > 0) throw new RequestValidationException(errors);
    }
}
