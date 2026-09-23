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
    string BookingMode,
    string? ExternalBookingCode,
    DateTime CheckInAt,
    DateTime CheckOutAt,
    short BilledNights,
    short? GuestCount,
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
    string? Version,
    IReadOnlyList<int>? AdditionalRoomIds = null);

public sealed record BookingStatusRequest(string Version);

public sealed record BookingDeleteRequest(string Version);

public sealed record BookingListItem(
    long Id,
    string BookingCode,
    string? GroupCode,
    string RoomNumber,
    string RoomTypeName,
    long CustomerId,
    string CustomerName,
    string? CustomerPhone,
    int ChannelId,
    string ChannelName,
    string ChannelCategory,
    string BookingMode,
    long? InvoiceId,
    string? InvoiceNumber,
    string? InvoiceStatus,
    DateTime CheckInAt,
    DateTime CheckOutAt,
    short BilledNights,
    short? GuestCount,
    decimal RoomRevenue,
    decimal ServiceRevenue,
    decimal GrossRevenue,
    decimal PaidAmount,
    decimal PreviousDebt,
    decimal DebtAmount,
    string Status,
    string Version);

public sealed record BookingOperationsSnapshot(
    DateTime HotelNow,
    DateOnly HotelDate,
    IReadOnlyList<BookingListItem> Items);

public sealed record BookingDetail(
    long Id,
    string BookingCode,
    string? GroupCode,
    int RoomId,
    string RoomNumber,
    string RoomTypeName,
    long CustomerId,
    string CustomerName,
    int ChannelId,
    string ChannelName,
    string ChannelCategory,
    string BookingMode,
    string? ExternalBookingCode,
    DateTime CheckInAt,
    DateTime CheckOutAt,
    short BilledNights,
    short? GuestCount,
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
    decimal AverageRoomRate,
    long? InvoiceId,
    string? InvoiceNumber,
    string? InvoiceStatus,
    string? Note,
    string Version);

public sealed record BookingRoomOption(
    int Id,
    string RoomNumber,
    string RoomTypeCode,
    string RoomTypeName,
    short Capacity,
    decimal? ListedPricePerNight,
    IReadOnlyList<BookingRoomRateOption> Rates);

public sealed record BookingRoomRateOption(
    string Code,
    decimal WeekdayPrice,
    decimal WeekendPrice,
    DateOnly? EffectiveFrom = null,
    DateOnly? EffectiveTo = null,
    decimal? MondayPrice = null,
    decimal? TuesdayPrice = null,
    decimal? WednesdayPrice = null,
    decimal? ThursdayPrice = null,
    decimal? FridayPrice = null,
    decimal? SaturdayPrice = null,
    decimal? SundayPrice = null);

public sealed record BookingChannelOption(int Id, string Code, string Name, string Category);

public sealed record BookingOptions(
    IReadOnlyList<BookingRoomOption> Rooms,
    IReadOnlyList<BookingChannelOption> Channels);
