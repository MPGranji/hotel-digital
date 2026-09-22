using System.Net.Mail;
using HotelDigital.Api.Infrastructure.Errors;

namespace HotelDigital.Api.Features.Bookings;

public static class BookingValidator
{
    public static void Validate(BookingWriteRequest request, bool requireVersion)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.RoomId <= 0) errors["roomId"] = ["Vui lòng chọn phòng."];
        if (request.AdditionalRoomIds?.Any(x => x <= 0) == true)
            errors["additionalRoomIds"] = ["Danh sách phòng bổ sung không hợp lệ."];
        if (request.AdditionalRoomIds?.Distinct().Count() > 9)
            errors["additionalRoomIds"] = ["Mỗi nhóm được tạo tối đa 10 phòng trong một lượt."];
        if (requireVersion && request.AdditionalRoomIds?.Count > 0)
            errors["additionalRoomIds"] = ["Không thể thêm phòng vào nhóm khi đang sửa một booking. Hãy tạo booking mới cùng nhóm."];
        if (request.CheckOutAt <= request.CheckInAt)
            errors["checkOutAt"] = ["Ngày giờ đi phải sau ngày giờ đến."];
        if (request.BilledNights < 1)
            errors["billedNights"] = ["Booking phải có ít nhất một đêm tính tiền."];
        if (request.GuestCount is <= 0)
            errors["guestCount"] = ["Số lượng khách phải lớn hơn 0 hoặc để trống nếu chưa xác định."];
        if (request.BookingMode is not ("RESERVATION" or "WALK_IN"))
            errors["bookingMode"] = ["Hình thức tiếp nhận booking không hợp lệ."];

        var amounts = new Dictionary<string, decimal>
        {
            ["roomRevenue"] = request.RoomRevenue,
            ["serviceRevenue"] = request.ServiceRevenue,
            ["surchargeAmount"] = request.SurchargeAmount,
            ["discountAmount"] = request.DiscountAmount,
            ["previousDebt"] = request.PreviousDebt,
            ["cashAmount"] = request.CashAmount,
            ["cardAmount"] = request.CardAmount,
            ["transferAmount"] = request.TransferAmount,
            ["debtAmount"] = request.DebtAmount
        };
        foreach (var amount in amounts.Where(x => x.Value < 0))
            errors[amount.Key] = ["Số tiền không được âm."];

        if (request.RoomRevenue + request.ServiceRevenue + request.SurchargeAmount - request.DiscountAmount < 0)
            errors["discountAmount"] = ["Giảm giá không được làm tổng doanh thu âm."];
        var grossAmount = request.PreviousDebt + request.RoomRevenue + request.ServiceRevenue + request.SurchargeAmount - request.DiscountAmount;
        var recordedAmount = request.CashAmount + request.CardAmount + request.TransferAmount + request.DebtAmount;
        if (!requireVersion && recordedAmount > grossAmount)
            errors["cashAmount"] = ["Tổng tiền cọc và công nợ không được vượt quá tổng tiền booking."];
        if (request.DiscountAmount > 0 && string.IsNullOrWhiteSpace(request.DiscountReason))
            errors["discountReason"] = ["Vui lòng nhập lý do giảm giá."];

        if (request.CustomerId.HasValue == (request.NewCustomer is not null))
            errors["customerId"] = ["Chọn một khách hàng hiện có hoặc nhập khách hàng mới."];
        if (request.NewCustomer is not null) ValidateNewCustomer(request.NewCustomer, errors);

        AddLengthError(errors, "externalBookingCode", request.ExternalBookingCode, 100, "Mã booking bên ngoài");
        AddLengthError(errors, "discountReason", request.DiscountReason, 300, "Lý do giảm giá");
        AddLengthError(errors, "promotionCode", request.PromotionCode, 50, "Mã chương trình");
        AddLengthError(errors, "invoiceNumber", request.InvoiceNumber, 50, "Số hóa đơn");
        AddLengthError(errors, "note", request.Note, 1000, "Ghi chú");

        if (requireVersion && !TryDecodeVersion(request.Version, out _))
            errors["version"] = ["Phiên bản dữ liệu không hợp lệ. Vui lòng tải lại."];

        if (errors.Count > 0) throw new RequestValidationException(errors);
    }

    public static byte[] DecodeVersion(string value)
    {
        if (!TryDecodeVersion(value, out var version))
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                ["version"] = ["Phiên bản dữ liệu không hợp lệ. Vui lòng tải lại."]
            });
        return version;
    }

    private static bool TryDecodeVersion(string? value, out byte[] version)
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

    private static void ValidateNewCustomer(
        BookingCustomerInput customer,
        IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(customer.FullName))
            errors["newCustomer.fullName"] = ["Vui lòng nhập họ và tên khách hàng."];
        AddLengthError(errors, "newCustomer.fullName", customer.FullName, 150, "Họ và tên");
        AddLengthError(errors, "newCustomer.phone", customer.Phone, 40, "Số điện thoại");
        AddLengthError(errors, "newCustomer.email", customer.Email, 254, "Email");
        AddLengthError(errors, "newCustomer.identityDocument", customer.IdentityDocument, 60, "CCCD/Passport");
        AddLengthError(errors, "newCustomer.nationality", customer.Nationality, 80, "Quốc tịch");
        AddLengthError(errors, "newCustomer.note", customer.Note, 500, "Ghi chú khách hàng");
        if (!string.IsNullOrWhiteSpace(customer.Email) && !MailAddress.TryCreate(customer.Email.Trim(), out _))
            errors["newCustomer.email"] = ["Email không đúng định dạng."];
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
