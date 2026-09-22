using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace HotelDigital.Api.Tests;

public sealed class FoundationTests
{
    private static HotelDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<HotelDbContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=HotelDigitalModelTest;Trusted_Connection=True")
            .Options;

        return new HotelDbContext(options);
    }

    [Fact]
    public void Model_maps_core_entities_to_hotel_schema()
    {
        using var db = CreateContext();

        Assert.Equal("hotel", db.Model.FindEntityType(typeof(Booking))?.GetSchema());
        Assert.Equal("Booking", db.Model.FindEntityType(typeof(Booking))?.GetTableName());
        Assert.Equal("AuditLog", db.Model.FindEntityType(typeof(AuditLog))?.GetTableName());
        Assert.Equal(12, db.Model.FindEntityType(typeof(Booking))?.FindProperty(nameof(Booking.BookingMode))?.GetMaxLength());
    }

    [Fact]
    public void Concurrency_columns_are_mapped_as_rowversion()
    {
        using var db = CreateContext();

        var bookingVersion = db.Model.FindEntityType(typeof(Booking))?.FindProperty(nameof(Booking.Version));
        var customerVersion = db.Model.FindEntityType(typeof(Customer))?.FindProperty(nameof(Customer.Version));
        var roomRateVersion = db.Model.FindEntityType(typeof(RoomRate))?.FindProperty(nameof(RoomRate.Version));

        Assert.True(bookingVersion?.IsConcurrencyToken);
        Assert.True(customerVersion?.IsConcurrencyToken);
        Assert.True(roomRateVersion?.IsConcurrencyToken);
        Assert.Equal(ValueGenerated.OnAddOrUpdate, bookingVersion?.ValueGenerated);
        Assert.Equal(ValueGenerated.OnAddOrUpdate, roomRateVersion?.ValueGenerated);
    }

    [Fact]
    public void Room_rates_are_queryable_as_temporal_history()
    {
        using var db = CreateContext();

        var sql = db.RoomRates.TemporalAll()
            .Where(x => x.RoomRateId == 1)
            .ToQueryString();

        Assert.Contains("FOR SYSTEM_TIME ALL", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("ValidFromUtc", sql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("ValidToUtc", sql, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Created_timestamps_are_generated_by_sql_server()
    {
        using var db = CreateContext();

        var bookingCreatedAt = db.Model.FindEntityType(typeof(Booking))?.FindProperty(nameof(Booking.CreatedAt));
        var customerCreatedAt = db.Model.FindEntityType(typeof(Customer))?.FindProperty(nameof(Customer.CreatedAt));

        Assert.Equal(ValueGenerated.OnAdd, bookingCreatedAt?.ValueGenerated);
        Assert.Equal(ValueGenerated.OnAdd, customerCreatedAt?.ValueGenerated);
        Assert.Equal("SYSUTCDATETIME()", bookingCreatedAt?.GetDefaultValueSql());
        Assert.Equal("SYSUTCDATETIME()", customerCreatedAt?.GetDefaultValueSql());
    }
}
