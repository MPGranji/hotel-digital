using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Infrastructure.Errors;

namespace HotelDigital.Api.Features.Bookings;

internal static class BookingMutation
{
    public static void Apply(Booking booking, BookingWriteRequest request)
    {
        booking.RoomId = request.RoomId;
        booking.ChannelId = request.ChannelId;
        booking.ExternalBookingCode = Clean(request.ExternalBookingCode);
        booking.CheckInAt = request.CheckInAt;
        booking.CheckOutAt = request.CheckOutAt;
        booking.BilledNights = request.BilledNights;
        booking.RoomRevenue = request.RoomRevenue;
        booking.ServiceRevenue = request.ServiceRevenue;
        booking.SurchargeAmount = request.SurchargeAmount;
        booking.DiscountAmount = request.DiscountAmount;
        booking.DiscountReason = Clean(request.DiscountReason);
        booking.PromotionCode = Clean(request.PromotionCode);
        booking.PreviousDebt = request.PreviousDebt;
        booking.CashAmount = request.CashAmount;
        booking.CardAmount = request.CardAmount;
        booking.TransferAmount = request.TransferAmount;
        booking.DebtAmount = request.DebtAmount;
        booking.InvoiceNumber = Clean(request.InvoiceNumber);
        booking.Note = Clean(request.Note);
    }

    public static void EnsureTransition(string currentStatus, string targetStatus)
    {
        var allowed = (currentStatus, targetStatus) switch
        {
            ("BOOKED", "CHECKED_IN") => true,
            ("BOOKED", "CANCELLED") => true,
            ("BOOKED", "NO_SHOW") => true,
            ("CHECKED_IN", "CHECKED_OUT") => true,
            _ => false
        };

        if (!allowed)
            throw new BusinessRuleException(
                "invalid_status_transition",
                "Không thể chuyển trạng thái đặt phòng theo thao tác này.");
    }

    public static string[] GetChangedFields(Booking current, BookingWriteRequest request)
    {
        var fields = new List<string>();
        AddIfChanged(fields, "Room", current.RoomId, request.RoomId);
        AddIfChanged(fields, "Customer", current.CustomerId, request.CustomerId);
        AddIfChanged(fields, "Channel", current.ChannelId, request.ChannelId);
        AddIfChanged(fields, "CheckInAt", current.CheckInAt, request.CheckInAt);
        AddIfChanged(fields, "CheckOutAt", current.CheckOutAt, request.CheckOutAt);
        AddIfChanged(fields, "BilledNights", current.BilledNights, request.BilledNights);
        AddIfChanged(fields, "RoomRevenue", current.RoomRevenue, request.RoomRevenue);
        AddIfChanged(fields, "ServiceRevenue", current.ServiceRevenue, request.ServiceRevenue);
        AddIfChanged(fields, "SurchargeAmount", current.SurchargeAmount, request.SurchargeAmount);
        AddIfChanged(fields, "DiscountAmount", current.DiscountAmount, request.DiscountAmount);
        AddIfChanged(fields, "Payments", current.CashAmount + current.CardAmount + current.TransferAmount,
            request.CashAmount + request.CardAmount + request.TransferAmount);
        AddIfChanged(fields, "DebtAmount", current.DebtAmount, request.DebtAmount);
        return [.. fields];
    }

    private static void AddIfChanged<T>(ICollection<string> fields, string name, T current, T requested)
    {
        if (!EqualityComparer<T>.Default.Equals(current, requested)) fields.Add(name);
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
