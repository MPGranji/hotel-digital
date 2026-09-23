using System.Data;
using System.Globalization;
using HotelDigital.Api.Data;
using HotelDigital.Api.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Features.Dashboard;

public sealed record DashboardMonth(
    string Month,
    long BookingCount,
    long ActualRoomNights,
    long AvailableRoomNights,
    decimal? OccupancyRate,
    decimal RoomRevenue,
    decimal ServiceRevenue,
    decimal PaidAmount,
    decimal? BookingAverageDailyRate);

public sealed record DashboardChannel(string Category, long BookingCount, decimal GrossRevenue);
public sealed record DashboardRoomType(string Name, decimal RoomRevenue, long ActualRoomNights,
    long AvailableRoomNights, decimal? OccupancyRate);
public sealed record DashboardSnapshot(string HotelNow, string SelectedMonth,
    IReadOnlyList<DashboardMonth> Months,
    IReadOnlyList<DashboardChannel> Channels,
    IReadOnlyList<DashboardRoomType> RoomTypes);

public sealed class DashboardQueryService(HotelDbContext db)
{
    public async Task<DashboardSnapshot> GetAsync(DateTime? requestedMonth, CancellationToken cancellationToken)
    {
        var hotelNow = HotelClock.Now();
        var currentMonth = new DateTime(hotelNow.Year, hotelNow.Month, 1);
        var months = new List<DashboardMonth>();
        var channels = new List<DashboardChannel>();
        var roomTypes = new List<DashboardRoomType>();

        await db.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            await using (var command = db.Database.GetDbConnection().CreateCommand())
            {
                command.CommandText = """
                    SELECT TOP (60) MonthStart, BookingCount, ActualRoomNights, AvailableRoomNights,
                           OccupancyRate, RoomRevenue, ServiceRevenue, PaidAmount, BookingAverageDailyRate
                    FROM hotel.vDashboardMonthly
                    WHERE MonthStart <= @currentMonth
                    ORDER BY MonthStart DESC;
                    """;
                AddMonthParameter(command, "@currentMonth", currentMonth);
                await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                    months.Add(new DashboardMonth(
                        reader.GetDateTime(0).ToString("yyyy-MM"), reader.GetInt64(1),
                        reader.GetInt64(2), reader.GetInt64(3),
                        reader.IsDBNull(4) ? null : reader.GetDecimal(4),
                        reader.GetDecimal(5), reader.GetDecimal(6), reader.GetDecimal(7),
                        reader.IsDBNull(8) ? null : reader.GetDecimal(8)));
            }
            months.Reverse();
            var selectedMonth = requestedMonth ??
                (months.Count > 0 ? DateTime.ParseExact(months[^1].Month, "yyyy-MM", CultureInfo.InvariantCulture) : currentMonth);

            await using (var command = db.Database.GetDbConnection().CreateCommand())
            {
                command.CommandText = """
                    SELECT ChannelCategory, SUM(BookingCount), SUM(GrossRevenue)
                    FROM hotel.vDashboardChannel
                    WHERE MonthStart = @month
                    GROUP BY ChannelCategory
                    ORDER BY SUM(GrossRevenue) DESC;
                    """;
                AddMonthParameter(command, "@month", selectedMonth);
                await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                    channels.Add(new DashboardChannel(reader.GetString(0), reader.GetInt64(1), reader.GetDecimal(2)));
            }

            await using (var command = db.Database.GetDbConnection().CreateCommand())
            {
                command.CommandText = """
                    SELECT RoomTypeName, RoomRevenue, ActualRoomNights, AvailableRoomNights, OccupancyRate
                    FROM hotel.vDashboardRoomType
                    WHERE MonthStart = @month
                    ORDER BY RoomRevenue DESC;
                    """;
                AddMonthParameter(command, "@month", selectedMonth);
                await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                    roomTypes.Add(new DashboardRoomType(reader.GetString(0), reader.GetDecimal(1),
                        reader.GetInt64(2), reader.GetInt64(3),
                        reader.IsDBNull(4) ? null : reader.GetDecimal(4)));
            }

            return new DashboardSnapshot(hotelNow.ToString("yyyy-MM-ddTHH:mm:ss"),
                selectedMonth.ToString("yyyy-MM"), months, channels, roomTypes);
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }

    private static void AddMonthParameter(IDbCommand command, string name, DateTime value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.DbType = DbType.Date;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }
}
