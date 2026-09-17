namespace HotelDigital.Api.Features.Bookings;

public static class PhamNguLaoRateCatalog
{
    // Source: BẢNG GIÁ - A26 Hotel.xlsx, sheet "Giá bán", range A65:O68.
    // Source values are expressed in thousands of VND.
    private static readonly IReadOnlyDictionary<string, IReadOnlyList<BookingRoomRateOption>> Rates =
        new Dictionary<string, IReadOnlyList<BookingRoomRateOption>>(StringComparer.OrdinalIgnoreCase)
        {
            ["STD-PNL"] = CreateRates(
                net: (900, 1100), fanpage: (1035, 1065), expedia: (1170, 1430),
                agoda: (1350, 1650), traveloka: (1188, 1452), booking: (1062, 1298)),
            ["SUP-PNL"] = CreateRates(
                net: (1000, 1200), fanpage: (1150, 1180), expedia: (1300, 1560),
                agoda: (1500, 1800), traveloka: (1320, 1584), booking: (1180, 1416)),
            ["DELUXE-PNL"] = CreateRates(
                net: (1400, 1600), fanpage: (1610, 1640), expedia: (1820, 2080),
                agoda: (2100, 2400), traveloka: (1848, 2112), booking: (1652, 1888)),
            ["SUP-Q-PNL"] = CreateRates(
                net: (1500, 1700), fanpage: (1725, 1755), expedia: (1950, 2210),
                agoda: (2250, 2550), traveloka: (1980, 2244), booking: (1770, 2006))
        };

    public static IReadOnlyList<BookingRoomRateOption> GetRates(string roomTypeCode) =>
        Rates.TryGetValue(roomTypeCode, out var rates) ? rates : [];

    public static decimal? GetListedPrice(string roomTypeCode) =>
        GetRates(roomTypeCode).FirstOrDefault(rate => rate.Code == "NET")?.WeekdayPrice;

    private static IReadOnlyList<BookingRoomRateOption> CreateRates(
        (decimal Weekday, decimal Weekend) net,
        (decimal Weekday, decimal Weekend) fanpage,
        (decimal Weekday, decimal Weekend) expedia,
        (decimal Weekday, decimal Weekend) agoda,
        (decimal Weekday, decimal Weekend) traveloka,
        (decimal Weekday, decimal Weekend) booking) =>
    [
        Rate("NET", net),
        Rate("FANPAGE", fanpage),
        Rate("EXPEDIA", expedia),
        Rate("AGODA", agoda),
        Rate("TRAVELOKA", traveloka),
        Rate("BOOKING", booking)
    ];

    private static BookingRoomRateOption Rate(
        string code,
        (decimal Weekday, decimal Weekend) price) =>
        new(code, price.Weekday * 1000, price.Weekend * 1000);
}
