namespace HotelDigital.Api.Features.Bookings;

public sealed record BookingCustomerInput(
    string FullName,
    string? Phone,
    string? Email,
    string? IdentityDocument,
    string? Nationality,
    string? Note);

public sealed record BookingWriteRequest(
    int RoomId,
    long? CustomerId,
    BookingCustomerInput? NewCustomer,
    int ChannelId,
    string? ExternalBookingCode,
    DateTime CheckInAt,
    DateTime CheckOutAt,
    short BilledNights,
    decimal RoomRevenue,
    decimal ServiceRevenue,
    decimal SurchargeAmount,
    decimal DiscountAmount,
    string? DiscountReason,
    string? PromotionCode,
    decimal PreviousDebt,
    decimal CashAmount,
    decimal CardAmount,
    decimal TransferAmount,
    decimal DebtAmount,
    string? InvoiceNumber,
    string? Note,
    string? Version);

public sealed record BookingStatusRequest(string Version);

public sealed record BookingListItem(
    long Id,
    string BookingCode,
    string RoomNumber,
    string RoomTypeName,
    long CustomerId,
    string CustomerName,
    string? CustomerPhone,
    int ChannelId,
    string ChannelName,
    DateTime CheckInAt,
    DateTime CheckOutAt,
    short BilledNights,
    decimal RoomRevenue,
    decimal ServiceRevenue,
    decimal GrossRevenue,
    decimal PaidAmount,
    decimal DebtAmount,
    decimal BalanceDue,
    string Status,
    string Version);

public sealed record BookingDetail(
    long Id,
    string BookingCode,
    int RoomId,
    string RoomNumber,
    string RoomTypeName,
    long CustomerId,
    string CustomerName,
    int ChannelId,
    string ChannelName,
    string? ExternalBookingCode,
    DateTime CheckInAt,
    DateTime CheckOutAt,
    short BilledNights,
    string Status,
    decimal RoomRevenue,
    decimal ServiceRevenue,
    decimal SurchargeAmount,
    decimal DiscountAmount,
    string? DiscountReason,
    string? PromotionCode,
    decimal PreviousDebt,
    decimal CashAmount,
    decimal CardAmount,
    decimal TransferAmount,
    decimal PaidAmount,
    decimal DebtAmount,
    decimal GrossRevenue,
    decimal BalanceDue,
    decimal AverageRoomRate,
    string? InvoiceNumber,
    string? Note,
    string Version);

public sealed record BookingRoomOption(
    int Id,
    string RoomNumber,
    string RoomTypeName,
    decimal? ListedPricePerNight);

public sealed record BookingChannelOption(int Id, string Code, string Name, string Category);

public sealed record BookingOptions(
    IReadOnlyList<BookingRoomOption> Rooms,
    IReadOnlyList<BookingChannelOption> Channels);
