using HotelDigital.Api.Features.Channels;
using HotelDigital.Api.Infrastructure.Errors;
using Xunit;

namespace HotelDigital.Api.Tests;

public sealed class ChannelValidatorTests
{
    [Theory]
    [InlineData("DIRECT")]
    [InlineData("OTA")]
    [InlineData("PARTNER")]
    [InlineData("INTERNAL")]
    [InlineData("UNKNOWN")]
    public void Supported_categories_are_accepted(string category)
    {
        ChannelValidator.Validate(new ChannelWriteRequest("TEST", "Kênh thử", category, true, null));
    }

    [Fact]
    public void Invalid_category_is_rejected()
    {
        var exception = Assert.Throws<RequestValidationException>(() =>
            ChannelValidator.Validate(new ChannelWriteRequest("TEST", "Kênh thử", "OTHER", true, null)));

        Assert.Contains("category", exception.Errors.Keys);
    }
}
