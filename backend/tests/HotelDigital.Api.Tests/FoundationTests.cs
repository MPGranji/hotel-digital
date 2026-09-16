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
    }

    [Fact]
    public void Concurrency_columns_are_mapped_as_rowversion()
    {
        using var db = CreateContext();

        var bookingVersion = db.Model.FindEntityType(typeof(Booking))?.FindProperty(nameof(Booking.Version));
        var customerVersion = db.Model.FindEntityType(typeof(Customer))?.FindProperty(nameof(Customer.Version));

        Assert.True(bookingVersion?.IsConcurrencyToken);
        Assert.True(customerVersion?.IsConcurrencyToken);
        Assert.Equal(ValueGenerated.OnAddOrUpdate, bookingVersion?.ValueGenerated);
    }
}
