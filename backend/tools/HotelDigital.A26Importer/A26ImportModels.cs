namespace HotelDigital.A26Importer;

public sealed record A26ImportRow(
    int SourceRow,
    string LegacyBookingCode,
    string RoomTypeCode,
    string RoomNumber,
    string CustomerName,
    DateTime CheckInAt,
    DateTime CheckOutAt,
    decimal RoomRevenue,
    decimal ServiceRevenue,
    decimal SurchargeAmount,
    decimal DiscountAmount,
    decimal PreviousDebt,
    decimal CashAmount,
    decimal CardAmount,
    decimal TransferAmount,
    decimal DebtAmount,
    decimal BalanceDue,
    string? Phone,
    string? Email,
    string? IdentityDocument,
    string ChannelCode,
    string InvoiceNumber,
    string? ExternalBookingCode,
    short BilledNights);

public sealed record A26ImportIssue(
    int SourceRow,
    string? InvoiceNumber,
    string Code,
    string Message,
    bool Blocking);

public sealed class A26ImportPlan(
    string fileName,
    string fileHash,
    int totalRows,
    int settledRows,
    IReadOnlyList<A26ImportRow> rows,
    IReadOnlyList<A26ImportIssue> issues)
{
    public string FileName { get; } = fileName;
    public string FileHash { get; } = fileHash;
    public int TotalRows { get; } = totalRows;
    public int SettledRows { get; } = settledRows;
    public IReadOnlyList<A26ImportRow> Rows { get; } = rows;
    public IReadOnlyList<A26ImportIssue> Issues { get; } = issues;

    public HashSet<int> BlockingSourceRows => Issues
        .Where(issue => issue.Blocking)
        .Select(issue => issue.SourceRow)
        .ToHashSet();

    public IReadOnlyList<A26ImportRow> ValidRows => Rows
        .Where(row => !BlockingSourceRows.Contains(row.SourceRow))
        .ToList();
}

public sealed record A26ImportResult(
    int ImportedRows,
    int SkippedDuplicateRows,
    int CreatedCustomers,
    int CreatedRoomTypes,
    int CreatedRooms,
    int CreatedChannels,
    decimal RoomRevenue,
    decimal ServiceRevenue,
    decimal GrossRevenue,
    decimal CashAmount,
    decimal TransferAmount,
    decimal DebtAmount,
    int BilledNights);
