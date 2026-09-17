using HotelDigital.Api.Features.Bookings;
using Xunit;

namespace HotelDigital.Api.Tests;

public sealed class PhamNguLaoRateCatalogTests
{
    [Theory]
    [InlineData("STD-PNL", "NET", 900_000, 1_100_000)]
    [InlineData("SUP-PNL", "AGODA", 1_500_000, 1_800_000)]
    [InlineData("DELUXE-PNL", "BOOKING", 1_652_000, 1_888_000)]
    [InlineData("SUP-Q-PNL", "TRAVELOKA", 1_980_000, 2_244_000)]
    public void Returns_prices_from_the_Pham_Ngu_Lao_rate_sheet(
        string roomTypeCode,
        string rateCode,
        decimal expectedWeekday,
        decimal expectedWeekend)
    {
        var rate = Assert.Single(
            PhamNguLaoRateCatalog.GetRates(roomTypeCode),
            item => item.Code == rateCode);

        Assert.Equal(expectedWeekday, rate.WeekdayPrice);
        Assert.Equal(expectedWeekend, rate.WeekendPrice);
    }

    [Fact]
    public void Unknown_room_type_has_no_prices()
    {
        Assert.Empty(PhamNguLaoRateCatalog.GetRates("UNKNOWN"));
        Assert.Null(PhamNguLaoRateCatalog.GetListedPrice("UNKNOWN"));
    }
}
