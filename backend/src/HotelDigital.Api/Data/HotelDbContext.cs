using HotelDigital.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Data;

public sealed class HotelDbContext(DbContextOptions<HotelDbContext> options) : DbContext(options)
{
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<RoomType> RoomTypes => Set<RoomType>();
    public DbSet<RoomRate> RoomRates => Set<RoomRate>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<RoomBlock> RoomBlocks => Set<RoomBlock>();
    public DbSet<Channel> Channels => Set<Channel>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("hotel");

        modelBuilder.Entity<Customer>(entity =>
        {
            entity.ToTable("Customer");
            entity.HasKey(x => x.CustomerId);
            entity.Property(x => x.CustomerId).HasColumnName("CustomerID");
            entity.Property(x => x.FullName).HasMaxLength(150);
            entity.Property(x => x.Phone).HasMaxLength(40).IsUnicode(false);
            entity.Property(x => x.Email).HasMaxLength(254);
            entity.Property(x => x.IdentityDocument).HasMaxLength(60);
            entity.Property(x => x.Nationality).HasMaxLength(80);
            entity.Property(x => x.Note).HasMaxLength(500);
            entity.Property(x => x.IsActive).HasDefaultValue(true);
            entity.Property(x => x.CreatedAt)
                .HasPrecision(0)
                .HasDefaultValueSql("SYSUTCDATETIME()")
                .ValueGeneratedOnAdd();
            entity.Property(x => x.Version).IsRowVersion();
        });

        modelBuilder.Entity<RoomType>(entity =>
        {
            entity.ToTable("RoomType");
            entity.HasKey(x => x.RoomTypeId);
            entity.Property(x => x.RoomTypeId).HasColumnName("RoomTypeID");
            entity.Property(x => x.Code).HasMaxLength(30).IsUnicode(false);
            entity.Property(x => x.Name).HasMaxLength(100);
            entity.Property(x => x.ListedPricePerNight).HasPrecision(19, 2);
        });

        modelBuilder.Entity<RoomRate>(entity =>
        {
            entity.ToTable("RoomRate", table => table.IsTemporal(temporal =>
            {
                temporal.HasPeriodStart("ValidFromUtc").HasColumnName("ValidFromUtc");
                temporal.HasPeriodEnd("ValidToUtc").HasColumnName("ValidToUtc");
                temporal.UseHistoryTable("RoomRateHistory", "hotel");
            }));
            entity.HasKey(x => x.RoomRateId);
            entity.Property(x => x.RoomRateId).HasColumnName("RoomRateID");
            entity.Property(x => x.RoomTypeId).HasColumnName("RoomTypeID");
            entity.Property(x => x.RateCode).HasMaxLength(20).IsUnicode(false);
            entity.Property(x => x.EffectiveFrom).HasColumnType("date");
            entity.Property(x => x.EffectiveTo).HasColumnType("date");
            entity.Property(x => x.WeekdayPrice).HasPrecision(19, 2);
            entity.Property(x => x.WeekendPrice).HasPrecision(19, 2);
            entity.Property(x => x.MondayPrice).HasPrecision(19, 2);
            entity.Property(x => x.TuesdayPrice).HasPrecision(19, 2);
            entity.Property(x => x.WednesdayPrice).HasPrecision(19, 2);
            entity.Property(x => x.ThursdayPrice).HasPrecision(19, 2);
            entity.Property(x => x.FridayPrice).HasPrecision(19, 2);
            entity.Property(x => x.SaturdayPrice).HasPrecision(19, 2);
            entity.Property(x => x.SundayPrice).HasPrecision(19, 2);
            entity.Property(x => x.Note).HasMaxLength(300);
            entity.Property(x => x.CreatedAt).HasPrecision(0).HasDefaultValueSql("SYSUTCDATETIME()").ValueGeneratedOnAdd();
            entity.Property(x => x.LastModifiedAtUtc).HasPrecision(0).HasDefaultValueSql("SYSUTCDATETIME()");
            entity.Property(x => x.LastModifiedByObjectId).HasMaxLength(80);
            entity.Property(x => x.LastModifiedByDisplayName).HasMaxLength(150);
            entity.Property(x => x.Version).IsRowVersion();
            entity.HasIndex(x => new { x.RoomTypeId, x.RateCode, x.EffectiveFrom });
            entity.HasOne(x => x.RoomType).WithMany(x => x.Rates).HasForeignKey(x => x.RoomTypeId);
        });

        modelBuilder.Entity<Room>(entity =>
        {
            entity.ToTable("Room");
            entity.HasKey(x => x.RoomId);
            entity.Property(x => x.RoomId).HasColumnName("RoomID");
            entity.Property(x => x.RoomTypeId).HasColumnName("RoomTypeID");
            entity.Property(x => x.RoomNumber).HasMaxLength(20).IsUnicode(false);
            entity.Property(x => x.FloorLabel).HasMaxLength(20);
            entity.Property(x => x.Note).HasMaxLength(500);
            entity.Property(x => x.Version).IsRowVersion();
            entity.HasOne(x => x.RoomType).WithMany(x => x.Rooms).HasForeignKey(x => x.RoomTypeId);
        });

        modelBuilder.Entity<RoomBlock>(entity =>
        {
            entity.ToTable("RoomBlock");
            entity.HasKey(x => x.RoomBlockId);
            entity.Property(x => x.RoomBlockId).HasColumnName("RoomBlockID");
            entity.Property(x => x.RoomId).HasColumnName("RoomID");
            entity.Property(x => x.StartAt).HasPrecision(0);
            entity.Property(x => x.EndAt).HasPrecision(0);
            entity.Property(x => x.Reason).HasMaxLength(120);
            entity.Property(x => x.Note).HasMaxLength(500);
            entity.Property(x => x.CreatedAt).HasPrecision(0).HasDefaultValueSql("SYSUTCDATETIME()").ValueGeneratedOnAdd();
            entity.Property(x => x.Version).IsRowVersion();
            entity.HasOne(x => x.Room).WithMany(x => x.Blocks).HasForeignKey(x => x.RoomId);
        });

        modelBuilder.Entity<Channel>(entity =>
        {
            entity.ToTable("Channel");
            entity.HasKey(x => x.ChannelId);
            entity.Property(x => x.ChannelId).HasColumnName("ChannelID");
            entity.Property(x => x.Code).HasMaxLength(40).IsUnicode(false);
            entity.Property(x => x.Name).HasMaxLength(100);
            entity.Property(x => x.Category).HasMaxLength(15).IsUnicode(false);
            entity.Property(x => x.CommissionRate).HasPrecision(5, 2);
            entity.Property(x => x.Note).HasMaxLength(300);
        });

        modelBuilder.Entity<Booking>(entity =>
        {
            entity.ToTable("Booking", table => table.HasTrigger("TR_Booking_PreventRoomOverlap"));
            entity.HasKey(x => x.BookingId);
            entity.Property(x => x.BookingId).HasColumnName("BookingID");
            entity.Property(x => x.BookingCode).HasMaxLength(20).IsUnicode(false).ValueGeneratedOnAddOrUpdate();
            entity.Property(x => x.LegacyBookingCode).HasMaxLength(50);
            entity.Property(x => x.RoomId).HasColumnName("RoomID");
            entity.Property(x => x.CustomerId).HasColumnName("CustomerID");
            entity.Property(x => x.ChannelId).HasColumnName("ChannelID");
            entity.Property(x => x.BookingMode).HasMaxLength(12).IsUnicode(false).HasDefaultValue("RESERVATION");
            entity.Property(x => x.ExternalBookingCode).HasMaxLength(100);
            entity.Property(x => x.GroupCode).HasMaxLength(40).IsUnicode(false);
            entity.Property(x => x.CheckInAt).HasPrecision(0);
            entity.Property(x => x.CheckOutAt).HasPrecision(0);
            entity.Property(x => x.Status).HasMaxLength(15).IsUnicode(false);
            entity.Property(x => x.RoomRevenue).HasPrecision(19, 2);
            entity.Property(x => x.ServiceRevenue).HasPrecision(19, 2);
            entity.Property(x => x.SurchargeAmount).HasPrecision(19, 2);
            entity.Property(x => x.DiscountAmount).HasPrecision(19, 2);
            entity.Property(x => x.PreviousDebt).HasPrecision(19, 2);
            entity.Property(x => x.CashAmount).HasPrecision(19, 2);
            entity.Property(x => x.CardAmount).HasPrecision(19, 2);
            entity.Property(x => x.TransferAmount).HasPrecision(19, 2);
            entity.Property(x => x.DebtAmount).HasPrecision(19, 2);
            entity.Property(x => x.GrossRevenue).HasPrecision(19, 2).ValueGeneratedOnAddOrUpdate();
            entity.Property(x => x.PaidAmount).HasPrecision(19, 2).ValueGeneratedOnAddOrUpdate();
            entity.Property(x => x.BalanceDue).HasPrecision(19, 2).ValueGeneratedOnAddOrUpdate();
            entity.Property(x => x.AverageRoomRate).HasPrecision(19, 2).ValueGeneratedOnAddOrUpdate();
            entity.Property(x => x.DiscountReason).HasMaxLength(300);
            entity.Property(x => x.PromotionCode).HasMaxLength(50);
            entity.Property(x => x.InvoiceNumber).HasMaxLength(50);
            entity.Property(x => x.Note).HasMaxLength(1000);
            entity.Property(x => x.CreatedAt)
                .HasPrecision(0)
                .HasDefaultValueSql("SYSUTCDATETIME()")
                .ValueGeneratedOnAdd();
            entity.Property(x => x.Version).IsRowVersion();
            entity.HasOne(x => x.Room).WithMany(x => x.Bookings).HasForeignKey(x => x.RoomId);
            entity.HasOne(x => x.Customer).WithMany(x => x.Bookings).HasForeignKey(x => x.CustomerId);
            entity.HasOne(x => x.Channel).WithMany(x => x.Bookings).HasForeignKey(x => x.ChannelId);
        });

        modelBuilder.Entity<Invoice>(entity =>
        {
            entity.ToTable("Invoice");
            entity.HasKey(x => x.InvoiceId);
            entity.Property(x => x.InvoiceId).HasColumnName("InvoiceID");
            entity.Property(x => x.BookingId).HasColumnName("BookingID");
            entity.Property(x => x.InvoiceNumber).HasMaxLength(50);
            entity.Property(x => x.IssuedAt).HasPrecision(0);
            entity.Property(x => x.Status).HasMaxLength(12).IsUnicode(false);
            entity.Property(x => x.GrossAmount).HasPrecision(19, 2);
            entity.Property(x => x.PaidAmount).HasPrecision(19, 2);
            entity.Property(x => x.DebtAmount).HasPrecision(19, 2);
            entity.Property(x => x.BalanceDue).HasPrecision(19, 2);
            entity.Property(x => x.Note).HasMaxLength(500);
            entity.Property(x => x.CreatedAt).HasPrecision(0).HasDefaultValueSql("SYSUTCDATETIME()").ValueGeneratedOnAdd();
            entity.Property(x => x.Version).IsRowVersion();
            entity.HasOne(x => x.Booking).WithOne(x => x.Invoice).HasForeignKey<Invoice>(x => x.BookingId);
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.ToTable("Payment");
            entity.HasKey(x => x.PaymentId);
            entity.Property(x => x.PaymentId).HasColumnName("PaymentID");
            entity.Property(x => x.BookingId).HasColumnName("BookingID");
            entity.Property(x => x.Amount).HasPrecision(19, 2);
            entity.Property(x => x.Method).HasMaxLength(12).IsUnicode(false);
            entity.Property(x => x.PaidAt).HasPrecision(0);
            entity.Property(x => x.ReferenceCode).HasMaxLength(100);
            entity.Property(x => x.Note).HasMaxLength(300);
            entity.Property(x => x.CreatedAt).HasPrecision(0).HasDefaultValueSql("SYSUTCDATETIME()").ValueGeneratedOnAdd();
            entity.Property(x => x.Version).IsRowVersion();
            entity.HasOne(x => x.Booking).WithMany(x => x.Payments).HasForeignKey(x => x.BookingId);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("AuditLog");
            entity.HasKey(x => x.AuditLogId);
            entity.Property(x => x.AuditLogId).HasColumnName("AuditLogID");
            entity.Property(x => x.OccurredAtUtc).HasPrecision(0);
            entity.Property(x => x.ActorObjectId).HasColumnName("ActorObjectID").HasMaxLength(80);
            entity.Property(x => x.ActorDisplayName).HasMaxLength(150);
            entity.Property(x => x.ActorEmail).HasMaxLength(254);
            entity.Property(x => x.ActorRole).HasMaxLength(100);
            entity.Property(x => x.Action).HasMaxLength(30).IsUnicode(false);
            entity.Property(x => x.EntityType).HasMaxLength(60).IsUnicode(false);
            entity.Property(x => x.EntityId).HasColumnName("EntityID").HasMaxLength(80).IsUnicode(false);
            entity.Property(x => x.ChangesJson).HasColumnType("nvarchar(max)");
            entity.Property(x => x.CorrelationId).HasColumnName("CorrelationID").HasMaxLength(100);
        });
    }
}
