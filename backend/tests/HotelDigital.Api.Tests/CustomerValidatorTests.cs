using HotelDigital.Api.Features.Customers;
using HotelDigital.Api.Infrastructure.Errors;
using Xunit;

namespace HotelDigital.Api.Tests;

public sealed class CustomerValidatorTests
{
    [Fact]
    public void Optional_contact_fields_can_be_empty()
    {
        var request = new CustomerUpsertRequest("Khách không có liên hệ", null, null, null, null, null, null);

        CustomerValidator.Validate(request, requireVersion: false);
    }

    [Fact]
    public void Invalid_email_is_rejected()
    {
        var request = new CustomerUpsertRequest("Nguyễn Văn A", null, "email-sai", null, null, null, null);

        var exception = Assert.Throws<RequestValidationException>(() =>
            CustomerValidator.Validate(request, requireVersion: false));

        Assert.Contains("email", exception.Errors.Keys);
    }
}
