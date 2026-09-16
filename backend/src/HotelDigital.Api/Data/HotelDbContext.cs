using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Data;

public sealed class HotelDbContext(DbContextOptions<HotelDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("hotel");
        base.OnModelCreating(modelBuilder);
    }
}
