namespace HotelDigital.Api.Data.Entities;

public sealed class Customer
{
    public long CustomerId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? IdentityDocument { get; set; }
    public string? Nationality { get; set; }
    public string? Note { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public byte[] Version { get; set; } = [];
    public ICollection<Booking> Bookings { get; set; } = [];
}

public sealed class RoomBlock
{
    public long RoomBlockId { get; set; }
    public int RoomId { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime EndAt { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Note { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public byte[] Version { get; set; } = [];
    public Room Room { get; set; } = null!;
}

public sealed class RoomType
{
    public int RoomTypeId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public short Capacity { get; set; }
    public decimal? ListedPricePerNight { get; set; }
    public bool IsActive { get; set; }
    public ICollection<Room> Rooms { get; set; } = [];
}

public sealed class Room
{
    public int RoomId { get; set; }
    public string RoomNumber { get; set; } = string.Empty;
    public int RoomTypeId { get; set; }
    public string? FloorLabel { get; set; }
    public bool IsActive { get; set; }
    public bool CountsTowardOccupancy { get; set; }
    public string? Note { get; set; }
    public byte[] Version { get; set; } = [];
    public RoomType RoomType { get; set; } = null!;
    public ICollection<Booking> Bookings { get; set; } = [];
    public ICollection<RoomBlock> Blocks { get; set; } = [];
}

public sealed class Channel
{
    public int ChannelId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal? CommissionRate { get; set; }
    public bool IsActive { get; set; }
    public string? Note { get; set; }
    public ICollection<Booking> Bookings { get; set; } = [];
}

public sealed class Booking
{
    public long BookingId { get; set; }
    public string BookingCode { get; private set; } = string.Empty;
    public string? LegacyBookingCode { get; set; }
    public int? LegacySourceRow { get; set; }
    public int RoomId { get; set; }
    public long CustomerId { get; set; }
    public int ChannelId { get; set; }
    public string? ExternalBookingCode { get; set; }
    public string? GroupCode { get; set; }
    public DateTime CheckInAt { get; set; }
    public DateTime CheckOutAt { get; set; }
    public short BilledNights { get; set; }
    public string Status { get; set; } = "BOOKED";
    public decimal RoomRevenue { get; set; }
    public decimal ServiceRevenue { get; set; }
    public decimal SurchargeAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public string? DiscountReason { get; set; }
    public string? PromotionCode { get; set; }
    public decimal PreviousDebt { get; set; }
    public decimal CashAmount { get; set; }
    public decimal CardAmount { get; set; }
    public decimal TransferAmount { get; set; }
    public decimal DebtAmount { get; set; }
    public decimal GrossRevenue { get; private set; }
    public decimal PaidAmount { get; private set; }
    public decimal BalanceDue { get; private set; }
    public decimal AverageRoomRate { get; private set; }
    public string? InvoiceNumber { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public byte[] Version { get; set; } = [];
    public Room Room { get; set; } = null!;
    public Customer Customer { get; set; } = null!;
    public Channel Channel { get; set; } = null!;
    public Invoice? Invoice { get; set; }
    public ICollection<Payment> Payments { get; set; } = [];
}

public sealed class Payment
{
    public long PaymentId { get; set; }
    public long BookingId { get; set; }
    public decimal Amount { get; set; }
    public string Method { get; set; } = string.Empty;
    public DateTime PaidAt { get; set; }
    public string? ReferenceCode { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public byte[] Version { get; set; } = [];
    public Booking Booking { get; set; } = null!;
}

public sealed class Invoice
{
    public long InvoiceId { get; set; }
    public long BookingId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public DateTime? IssuedAt { get; set; }
    public string Status { get; set; } = "DRAFT";
    public decimal GrossAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal DebtAmount { get; set; }
    public decimal BalanceDue { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public byte[] Version { get; set; } = [];
    public Booking Booking { get; set; } = null!;
}

public sealed class AuditLog
{
    public long AuditLogId { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    public string ActorObjectId { get; set; } = string.Empty;
    public string? ActorDisplayName { get; set; }
    public string? ActorEmail { get; set; }
    public string? ActorRole { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string ChangesJson { get; set; } = "{}";
    public string CorrelationId { get; set; } = string.Empty;
}
