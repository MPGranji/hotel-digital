using System.Text.Json;
using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.A26Importer;

public sealed class A26ImportService(HotelDbContext db)
{
    private static readonly IReadOnlyDictionary<string, (string Name, short Capacity, decimal? ListedPrice)> RoomTypeDefaults =
        new Dictionary<string, (string, short, decimal?)>(StringComparer.OrdinalIgnoreCase)
        {
            ["STD-PNL"] = ("Standard", 2, 900_000m),
            ["SUP-PNL"] = ("Superior", 3, 1_000_000m),
            ["SUP-Q-PNL"] = ("Superior Queen", 2, 1_500_000m),
            ["DELUXE-PNL"] = ("Deluxe", 2, 1_400_000m),
            ["MB-PNL"] = ("Master Bill", 1, null)
        };

    private static readonly IReadOnlyDictionary<string, (string Name, string Category)> ChannelDefaults =
        new Dictionary<string, (string, string)>(StringComparer.OrdinalIgnoreCase)
        {
            ["DIRECT"] = ("Đặt trực tiếp", "OFFLINE"),
            ["ONLINE"] = ("Online", "ONLINE"),
            ["TRAVEL_AGENT"] = ("Đại lý du lịch", "TRAVEL_AGENCY"),
            ["COMPANY"] = ("Công ty", "TRAVEL_AGENCY")
        };

    public async Task<A26ImportResult> ImportValidRowsAsync(A26ImportPlan plan, CancellationToken cancellationToken)
    {
        var validRows = plan.ValidRows;
        var invoiceNumbers = validRows.Select(row => row.InvoiceNumber).ToArray();
        var existingInvoices = await db.Bookings.AsNoTracking()
            .Where(booking => booking.InvoiceNumber != null && invoiceNumbers.Contains(booking.InvoiceNumber))
            .Select(booking => booking.InvoiceNumber!)
            .ToHashSetAsync(StringComparer.OrdinalIgnoreCase, cancellationToken);
        var rowsToImport = validRows.Where(row => !existingInvoices.Contains(row.InvoiceNumber)).ToArray();

        var executionStrategy = db.Database.CreateExecutionStrategy();
        return await executionStrategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            var roomTypes = await db.RoomTypes.ToDictionaryAsync(item => item.Code, StringComparer.OrdinalIgnoreCase, cancellationToken);
            var rooms = await db.Rooms.ToDictionaryAsync(item => item.RoomNumber, StringComparer.OrdinalIgnoreCase, cancellationToken);
            var channels = await db.Channels.ToDictionaryAsync(item => item.Code, StringComparer.OrdinalIgnoreCase, cancellationToken);
            var createdRoomTypes = 0;
            var createdRooms = 0;
            var createdChannels = 0;

            foreach (var row in rowsToImport)
            {
                if (!roomTypes.TryGetValue(row.RoomTypeCode, out var roomType))
                {
                    (string Name, short Capacity, decimal? ListedPrice) defaults = RoomTypeDefaults.TryGetValue(row.RoomTypeCode, out var known)
                        ? known
                        : (row.RoomTypeCode, (short)1, null);
                    roomType = new RoomType
                    {
                        Code = row.RoomTypeCode,
                        Name = defaults.Name,
                        Capacity = defaults.Capacity,
                        ListedPricePerNight = defaults.ListedPrice,
                        IsActive = true
                    };
                    roomTypes.Add(row.RoomTypeCode, roomType);
                    db.RoomTypes.Add(roomType);
                    createdRoomTypes++;
                }

                if (!rooms.ContainsKey(row.RoomNumber))
                {
                    var isMasterBill = string.Equals(row.RoomNumber, "MB-PNL", StringComparison.OrdinalIgnoreCase);
                    var room = new Room
                    {
                        RoomNumber = row.RoomNumber,
                        RoomType = roomType,
                        FloorLabel = isMasterBill ? null : GetFloorLabel(row.RoomNumber),
                        IsActive = true,
                        CountsTowardOccupancy = !isMasterBill,
                        Note = isMasterBill ? "Pseudo-room/master bill imported from legacy data." : null
                    };
                    rooms.Add(row.RoomNumber, room);
                    db.Rooms.Add(room);
                    createdRooms++;
                }

                if (!channels.ContainsKey(row.ChannelCode))
                {
                    if (!ChannelDefaults.TryGetValue(row.ChannelCode, out var defaults))
                        throw new InvalidOperationException($"Unsupported channel code: {row.ChannelCode}.");
                    var channel = new Channel
                    {
                        Code = row.ChannelCode,
                        Name = defaults.Name,
                        Category = defaults.Category,
                        IsActive = true
                    };
                    channels.Add(row.ChannelCode, channel);
                    db.Channels.Add(channel);
                    createdChannels++;
                }
            }

            await db.SaveChangesAsync(cancellationToken);

            foreach (var row in rowsToImport)
            {
                var customer = new Customer
                {
                    FullName = row.CustomerName,
                    Phone = Clean(row.Phone),
                    Email = Clean(row.Email),
                    IdentityDocument = Clean(row.IdentityDocument),
                    Note = $"Imported from {plan.FileName}, row {row.SourceRow}."
                };
                db.Customers.Add(customer);
                db.Bookings.Add(new Booking
                {
                    LegacyBookingCode = row.LegacyBookingCode,
                    LegacySourceRow = row.SourceRow,
                    Room = rooms[row.RoomNumber],
                    Customer = customer,
                    Channel = channels[row.ChannelCode],
                    ExternalBookingCode = Clean(row.ExternalBookingCode),
                    CheckInAt = row.CheckInAt,
                    CheckOutAt = row.CheckOutAt,
                    BilledNights = row.BilledNights,
                    Status = "CHECKED_OUT",
                    RoomRevenue = row.RoomRevenue,
                    ServiceRevenue = row.ServiceRevenue,
                    SurchargeAmount = row.SurchargeAmount,
                    DiscountAmount = row.DiscountAmount,
                    DiscountReason = row.DiscountAmount > 0 ? "Dữ liệu cũ - cần xác minh" : null,
                    PreviousDebt = row.PreviousDebt,
                    CashAmount = row.CashAmount,
                    CardAmount = row.CardAmount,
                    TransferAmount = row.TransferAmount,
                    DebtAmount = row.DebtAmount,
                    InvoiceNumber = row.InvoiceNumber,
                    Note = $"Historical A26 import; source row {row.SourceRow}."
                });
            }

            db.AuditLogs.Add(new AuditLog
            {
                OccurredAtUtc = DateTime.UtcNow,
                ActorObjectId = "local-a26-importer",
                ActorDisplayName = "A26 historical importer",
                Action = "IMPORT",
                EntityType = "BookingBatch",
                EntityId = plan.FileHash,
                ChangesJson = JsonSerializer.Serialize(new
                {
                    plan.FileName,
                    plan.FileHash,
                    importedRows = rowsToImport.Length,
                    skippedDuplicateRows = validRows.Count - rowsToImport.Length,
                    rejectedRows = plan.BlockingSourceRows.Count
                }),
                CorrelationId = Guid.NewGuid().ToString("N")
            });

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return new A26ImportResult(
                rowsToImport.Length,
                validRows.Count - rowsToImport.Length,
                rowsToImport.Length,
                createdRoomTypes,
                createdRooms,
                createdChannels,
                rowsToImport.Sum(row => row.RoomRevenue),
                rowsToImport.Sum(row => row.ServiceRevenue),
                rowsToImport.Sum(row => row.RoomRevenue + row.ServiceRevenue + row.SurchargeAmount - row.DiscountAmount),
                rowsToImport.Sum(row => row.CashAmount),
                rowsToImport.Sum(row => row.TransferAmount),
                rowsToImport.Sum(row => row.DebtAmount),
                rowsToImport.Sum(row => row.BilledNights));
        });
    }

    private static string? GetFloorLabel(string roomNumber) =>
        roomNumber.Length > 0 && char.IsDigit(roomNumber[0]) ? roomNumber[0].ToString() : null;

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
