using HotelDigital.Api.Features.Bookings;
using HotelDigital.Api.Infrastructure.Errors;
using Xunit;

namespace HotelDigital.Api.Tests;

public sealed class BookingValidatorTests
{
    [Fact]
    public void Valid_booking_is_accepted()
    {
        var request = ValidRequest();

        BookingValidator.Validate(request, requireVersion: false);
    }

    [Fact]
    public void Checkout_must_be_after_checkin()
    {
        var request = ValidRequest() with { CheckOutAt = new DateTime(2026, 9, 17, 14, 0, 0) };

        var exception = Assert.Throws<RequestValidationException>(() =>
            BookingValidator.Validate(request, requireVersion: false));

        Assert.Contains("checkOutAt", exception.Errors.Keys);
    }

    [Fact]
    public void Discount_requires_reason_and_non_negative_total()
    {
        var request = ValidRequest() with { DiscountAmount = 600_000, DiscountReason = null };

        var exception = Assert.Throws<RequestValidationException>(() =>
            BookingValidator.Validate(request, requireVersion: false));

        Assert.Contains("discountAmount", exception.Errors.Keys);
        Assert.Contains("discountReason", exception.Errors.Keys);
    }

    [Fact]
    public void Exactly_one_customer_source_is_required()
    {
        var request = ValidRequest() with
        {
            CustomerId = 1,
            NewCustomer = new BookingCustomerInput("Khách mới", null, null, null, null, null)
        };

        var exception = Assert.Throws<RequestValidationException>(() =>
            BookingValidator.Validate(request, requireVersion: false));

        Assert.Contains("customerId", exception.Errors.Keys);
    }

    [Fact]
    public void Booking_mode_must_be_supported()
    {
        var request = ValidRequest() with { BookingMode = "UNKNOWN" };

        var exception = Assert.Throws<RequestValidationException>(() =>
            BookingValidator.Validate(request, requireVersion: false));

        Assert.Contains("bookingMode", exception.Errors.Keys);
    }

    [Fact]
    public void Initial_collection_cannot_exceed_booking_total()
    {
        var request = ValidRequest() with { CashAmount = 500_001 };

        var exception = Assert.Throws<RequestValidationException>(() =>
            BookingValidator.Validate(request, requireVersion: false));

        Assert.Contains("cashAmount", exception.Errors.Keys);
    }

    [Fact]
    public void Existing_payment_values_are_not_revalidated_as_an_edit()
    {
        var request = ValidRequest() with
        {
            CashAmount = 600_000,
            Version = Convert.ToBase64String(new byte[8])
        };

        BookingValidator.Validate(request, requireVersion: true);
    }

    private static BookingWriteRequest ValidRequest() => new(
        RoomId: 1,
        CustomerId: 1,
        NewCustomer: null,
        ChannelId: 1,
        BookingMode: "RESERVATION",
        ExternalBookingCode: null,
        CheckInAt: new DateTime(2026, 9, 17, 14, 0, 0),
        CheckOutAt: new DateTime(2026, 9, 18, 12, 0, 0),
        BilledNights: 1,
        RoomRevenue: 500_000,
        ServiceRevenue: 0,
        SurchargeAmount: 0,
        DiscountAmount: 0,
        DiscountReason: null,
        PromotionCode: null,
        PreviousDebt: 0,
        CashAmount: 0,
        CardAmount: 0,
        TransferAmount: 0,
        DebtAmount: 0,
        InvoiceNumber: null,
        Note: null,
        Version: null);
}
