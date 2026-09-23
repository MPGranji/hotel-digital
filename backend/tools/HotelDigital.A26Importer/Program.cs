using System.Text.Json;
using HotelDigital.A26Importer;
using HotelDigital.Api.Data;
using HotelDigital.Api.Features.Dashboard;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

var arguments = CliArguments.Parse(args);
A26ImportPlan? plan = null;
if (!arguments.SchemaOnly && !arguments.VerifyOnly)
{
    var reader = new A26WorkbookReader();
    plan = reader.Read(arguments.FilePath!);

    PrintPreview(plan);
    if (!arguments.Commit)
    {
        Console.WriteLine("Dry-run hoàn tất. Dùng --commit để nhập các dòng hợp lệ.");
        return;
    }
}

var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__HotelDatabase")
    ?? Environment.GetEnvironmentVariable("HOTEL_DATABASE_CONNECTION_STRING")
    ?? ReadEnvironmentValue(arguments.EnvironmentFile, "HOTEL_DATABASE_CONNECTION_STRING")
    ?? throw new InvalidOperationException("Chưa cấu hình HOTEL_DATABASE_CONNECTION_STRING.");

if (connectionString.Contains("Authentication=Active Directory Device Code Flow", StringComparison.OrdinalIgnoreCase))
{
    var provider = new ActiveDirectoryAuthenticationProvider(result =>
    {
        Console.Error.WriteLine(result.Message);
        return Task.CompletedTask;
    });
    SqlAuthenticationProvider.SetProvider(SqlAuthenticationMethod.ActiveDirectoryDeviceCodeFlow, provider);
}

var databaseAccessToken = Environment.GetEnvironmentVariable("HOTEL_DATABASE_ACCESS_TOKEN");
if (!string.IsNullOrWhiteSpace(databaseAccessToken))
{
    var connectionBuilder = new SqlConnectionStringBuilder(connectionString);
    connectionBuilder.Remove("Authentication");
    connectionString = connectionBuilder.ConnectionString;
}

var dbOptions = new DbContextOptionsBuilder<HotelDbContext>()
    .UseAzureSql(connectionString, options => options.EnableRetryOnFailure())
    .Options;
await using var db = new HotelDbContext(dbOptions);
if (!string.IsNullOrWhiteSpace(databaseAccessToken))
{
    ((SqlConnection)db.Database.GetDbConnection()).AccessToken = databaseAccessToken;
}
if (arguments.SchemaScriptPath is not null)
{
    await ApplySqlScriptAsync(db, arguments.SchemaScriptPath, CancellationToken.None);
    Console.WriteLine($"Đã áp dụng schema script: {Path.GetFileName(arguments.SchemaScriptPath)}");
}
if (arguments.VerifyOnly)
{
    await PrintDatabaseFingerprintAsync(db, CancellationToken.None);
    var dashboard = await new DashboardQueryService(db).GetAsync(null, CancellationToken.None);
    Console.WriteLine(JsonSerializer.Serialize(new
    {
        DashboardSelectedMonth = dashboard.SelectedMonth,
        DashboardMonthCount = dashboard.Months.Count,
        DashboardChannelCount = dashboard.Channels.Count,
        DashboardRoomTypeCount = dashboard.RoomTypes.Count
    }, new JsonSerializerOptions { WriteIndented = true }));
    return;
}
if (arguments.SchemaOnly) return;

var importer = new A26ImportService(db);
var result = await importer.ImportValidRowsAsync(plan!, CancellationToken.None);
Console.WriteLine(JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }));

static async Task ApplySqlScriptAsync(
    HotelDbContext db,
    string scriptPath,
    CancellationToken cancellationToken)
{
    if (!File.Exists(scriptPath))
        throw new FileNotFoundException("Không tìm thấy schema script.", scriptPath);

    var script = await File.ReadAllTextAsync(scriptPath, cancellationToken);
    var batches = System.Text.RegularExpressions.Regex.Split(
        script,
        @"^\s*GO\s*(?:--.*)?$",
        System.Text.RegularExpressions.RegexOptions.Multiline |
        System.Text.RegularExpressions.RegexOptions.IgnoreCase);

    await db.Database.OpenConnectionAsync(cancellationToken);
    try
    {
        foreach (var batch in batches.Where(value => !string.IsNullOrWhiteSpace(value)))
        {
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandText = batch;
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }
    finally
    {
        await db.Database.CloseConnectionAsync();
    }
}

static async Task PrintDatabaseFingerprintAsync(HotelDbContext db, CancellationToken cancellationToken)
{
    const string sql = """
        SELECT
          (SELECT COUNT_BIG(*) FROM hotel.Booking) AS BookingCount,
          (SELECT COALESCE(SUM(GrossRevenue), 0) FROM hotel.Booking) AS BookingGross,
          (SELECT COALESCE(SUM(PaidAmount), 0) FROM hotel.Booking) AS BookingPaid,
          (SELECT COUNT_BIG(*) FROM hotel.Payment) AS PaymentCount,
          (SELECT COALESCE(SUM(Amount), 0) FROM hotel.Payment) AS PaymentTotal,
          (SELECT COUNT_BIG(*) FROM hotel.Invoice) AS InvoiceCount,
          (SELECT COUNT_BIG(*) FROM (SELECT BookingID FROM hotel.Invoice GROUP BY BookingID HAVING COUNT_BIG(*) > 1) duplicates) AS DuplicateInvoiceBookings,
          (SELECT COUNT_BIG(*) FROM hotel.Invoice invoice LEFT JOIN hotel.Booking booking ON booking.BookingID = invoice.BookingID WHERE booking.BookingID IS NULL) AS OrphanInvoices,
          (SELECT COUNT_BIG(*) FROM hotel.Booking WHERE GuestCount IS NULL) AS MissingGuestCounts,
          (SELECT COUNT_BIG(*)
             FROM hotel.Booking booking
             JOIN hotel.Room room ON room.RoomID = booking.RoomID
             JOIN hotel.RoomType roomType ON roomType.RoomTypeID = room.RoomTypeID
            WHERE booking.GuestCount <= 0 OR booking.GuestCount > roomType.Capacity) AS InvalidGuestCounts,
          (SELECT COUNT_BIG(*) FROM hotel.vDimDate) AS DateRows,
          (SELECT COUNT_BIG(*) FROM hotel.vDimRoom WHERE IsPhysicalRoom = 1) AS PhysicalRoomCount,
          (SELECT COUNT_BIG(*) FROM hotel.vFactBooking) AS FactBookingCount,
          (SELECT COALESCE(SUM(GrossRevenue), 0) FROM hotel.vFactBooking) AS FactBookingGross,
          (SELECT COUNT_BIG(*) FROM hotel.vFactPayment) AS FactPaymentCount,
          (SELECT COALESCE(SUM(Amount), 0) FROM hotel.vFactPayment) AS FactPaymentTotal,
          (SELECT COUNT_BIG(*) FROM hotel.vFactRoomNight) AS FactRoomNightCount,
          (SELECT COUNT_BIG(*) FROM hotel.vFactRoomDay) AS FactRoomDayCount,
          (SELECT COUNT_BIG(*)
             FROM (
               SELECT RoomID, DateKey
               FROM hotel.vFactRoomDay
               GROUP BY RoomID, DateKey
               HAVING COUNT_BIG(*) > 1
             ) duplicates) AS DuplicateRoomDays,
          (SELECT COUNT_BIG(*)
             FROM hotel.vFactRoomDay
            WHERE RoomStatusKey NOT BETWEEN 1 AND 5
               OR PaymentStatusKey NOT BETWEEN 0 AND 3) AS InvalidRoomDayStatuses,
          (SELECT COUNT_BIG(*)
             FROM (
               SELECT RoomID, StayDateKey
               FROM hotel.vFactRoomNight
               GROUP BY RoomID, StayDateKey
               HAVING COUNT_BIG(*) > 1
             ) overlaps) AS OverlappingRoomNights,
          (SELECT COUNT_BIG(*)
             FROM hotel.vFactRoomDay
            WHERE BookingID IS NOT NULL
              AND IsMaintenanceBlocked = 1) AS BookingMaintenanceConflicts,
          (SELECT COUNT_BIG(*)
             FROM hotel.vFactRoomDay
            WHERE BookingID IS NOT NULL
              AND RoomIsCurrentlyActive = 0) AS InactiveRoomBookingDays,
          (SELECT COUNT_BIG(*)
             FROM hotel.Booking booking
             OUTER APPLY (
               SELECT COALESCE(SUM(payment.Amount), 0) AS PaymentTotal
               FROM hotel.Payment payment
               WHERE payment.BookingID = booking.BookingID
             ) payments
            WHERE booking.PaidAmount <> payments.PaymentTotal) AS BookingPaymentMismatches,
          (SELECT COUNT_BIG(*)
             FROM sys.columns columnInfo
             JOIN sys.views viewInfo ON viewInfo.object_id = columnInfo.object_id
             JOIN sys.schemas schemaInfo ON schemaInfo.schema_id = viewInfo.schema_id
            WHERE schemaInfo.name = N'hotel'
              AND viewInfo.name IN (N'vFactBooking', N'vFactPayment', N'vFactRoomNight', N'vFactRoomDay')
              AND columnInfo.name IN (N'CustomerID', N'CustomerName', N'FullName', N'Phone', N'Email', N'Address')) AS PublicFactPiiColumns,
          DB_NAME() AS DatabaseName,
          (SELECT COALESCE(MAX(definition), N'')
             FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID(N'hotel.Payment')
              AND name = N'CK_Payment_Amount') AS PaymentAmountConstraint,
          (SELECT COUNT_BIG(*)
             FROM sys.database_permissions permission
             JOIN sys.database_principals principal ON principal.principal_id = permission.grantee_principal_id
            WHERE principal.name = N'hotel_app'
              AND permission.class = 1
              AND permission.major_id = OBJECT_ID(N'hotel.Payment')
              AND permission.permission_name IN (N'UPDATE', N'DELETE')
              AND permission.state = N'D') AS PaymentUpdateDeleteDenials,
          (SELECT COUNT_BIG(*) FROM hotel.Payment WHERE Amount < 0) AS NegativePaymentCount;
        """;

    await db.Database.OpenConnectionAsync(cancellationToken);
    try
    {
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.CommandText = sql;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);
        var result = new
        {
            BookingCount = reader.GetInt64(0),
            BookingGross = reader.GetDecimal(1),
            BookingPaid = reader.GetDecimal(2),
            PaymentCount = reader.GetInt64(3),
            PaymentTotal = reader.GetDecimal(4),
            InvoiceCount = reader.GetInt64(5),
            DuplicateInvoiceBookings = reader.GetInt64(6),
            OrphanInvoices = reader.GetInt64(7),
            MissingGuestCounts = reader.GetInt64(8),
            InvalidGuestCounts = reader.GetInt64(9),
            DateRows = reader.GetInt64(10),
            PhysicalRoomCount = reader.GetInt64(11),
            FactBookingCount = reader.GetInt64(12),
            FactBookingGross = reader.GetDecimal(13),
            FactPaymentCount = reader.GetInt64(14),
            FactPaymentTotal = reader.GetDecimal(15),
            FactRoomNightCount = reader.GetInt64(16),
            FactRoomDayCount = reader.GetInt64(17),
            DuplicateRoomDays = reader.GetInt64(18),
            InvalidRoomDayStatuses = reader.GetInt64(19),
            OverlappingRoomNights = reader.GetInt64(20),
            BookingMaintenanceConflicts = reader.GetInt64(21),
            InactiveRoomBookingDays = reader.GetInt64(22),
            BookingPaymentMismatches = reader.GetInt64(23),
            PublicFactPiiColumns = reader.GetInt64(24),
            DatabaseName = reader.GetString(25),
            PaymentAmountConstraint = reader.GetString(26),
            PaymentUpdateDeleteDenials = reader.GetInt64(27),
            NegativePaymentCount = reader.GetInt64(28)
        };
        Console.WriteLine(JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }));
        await reader.CloseAsync();

        await using var principalCommand = db.Database.GetDbConnection().CreateCommand();
        principalCommand.CommandText = """
            SELECT principal.name, principal.type_desc,
                   COALESCE(STRING_AGG(role.name, N', '), N'') AS DatabaseRoles
            FROM sys.database_principals principal
            LEFT JOIN sys.database_role_members membership ON membership.member_principal_id = principal.principal_id
            LEFT JOIN sys.database_principals role ON role.principal_id = membership.role_principal_id
            WHERE principal.type IN ('E', 'X')
            GROUP BY principal.name, principal.type_desc
            ORDER BY principal.name;
            """;
        var externalPrincipals = new List<object>();
        await using var principalReader = await principalCommand.ExecuteReaderAsync(cancellationToken);
        while (await principalReader.ReadAsync(cancellationToken))
            externalPrincipals.Add(new
            {
                Name = principalReader.GetString(0),
                Type = principalReader.GetString(1),
                DatabaseRoles = principalReader.GetString(2)
            });
        Console.WriteLine(JsonSerializer.Serialize(new { ExternalPrincipals = externalPrincipals },
            new JsonSerializerOptions { WriteIndented = true }));
    }
    finally
    {
        await db.Database.CloseConnectionAsync();
    }
}

static void PrintPreview(A26ImportPlan plan)
{
    var blockingRows = plan.BlockingSourceRows;
    var summary = new
    {
        plan.FileName,
        plan.FileHash,
        plan.TotalRows,
        plan.SettledRows,
        ValidRows = plan.ValidRows.Count,
        ErrorRows = blockingRows.Count,
        WarningRows = plan.Issues.Where(issue => !issue.Blocking).Select(issue => issue.SourceRow).Distinct().Count(),
        Issues = plan.Issues
            .GroupBy(issue => new { issue.Code, issue.Blocking })
            .Select(group => new { group.Key.Code, group.Key.Blocking, Count = group.Select(issue => issue.SourceRow).Distinct().Count() })
            .OrderByDescending(item => item.Blocking)
            .ThenBy(item => item.Code),
        RejectedSourceRows = blockingRows.OrderBy(row => row)
    };
    Console.WriteLine(JsonSerializer.Serialize(summary, new JsonSerializerOptions { WriteIndented = true }));
}

static string? ReadEnvironmentValue(string path, string key)
{
    if (!File.Exists(path)) return null;
    var prefix = key + "=";
    var line = File.ReadLines(path).FirstOrDefault(value => value.StartsWith(prefix, StringComparison.Ordinal));
    return line?[prefix.Length..].Trim();
}

internal sealed record CliArguments(
    string? FilePath,
    string EnvironmentFile,
    string? SchemaScriptPath,
    bool Commit,
    bool SchemaOnly,
    bool VerifyOnly)
{
    public static CliArguments Parse(IReadOnlyList<string> args)
    {
        string? file = null;
        var environmentFile = Path.Combine("backend", ".env");
        string? schemaScript = null;
        var commit = false;
        var schemaOnly = false;
        var verifyOnly = false;
        for (var index = 0; index < args.Count; index++)
        {
            switch (args[index])
            {
                case "--file" when index + 1 < args.Count:
                    file = args[++index];
                    break;
                case "--env-file" when index + 1 < args.Count:
                    environmentFile = args[++index];
                    break;
                case "--schema-script" when index + 1 < args.Count:
                    schemaScript = args[++index];
                    break;
                case "--commit":
                    commit = true;
                    break;
                case "--schema-only":
                    schemaOnly = true;
                    break;
                case "--verify-only":
                    verifyOnly = true;
                    break;
                default:
                    throw new ArgumentException($"Tham số không hợp lệ: {args[index]}");
            }
        }

        if (!schemaOnly && !verifyOnly && string.IsNullOrWhiteSpace(file))
            throw new ArgumentException("Thiếu --file <đường-dẫn-xlsx>.");
        if (verifyOnly && (schemaOnly || commit || !string.IsNullOrWhiteSpace(schemaScript)))
            throw new ArgumentException("--verify-only không dùng cùng các tùy chọn ghi dữ liệu.");
        if (schemaOnly && string.IsNullOrWhiteSpace(schemaScript))
            throw new ArgumentException("--schema-only yêu cầu --schema-script <đường-dẫn-sql>.");
        if (schemaOnly && !commit)
            throw new ArgumentException("--schema-only yêu cầu --commit để xác nhận thay đổi database.");
        return new CliArguments(
            file is null ? null : Path.GetFullPath(file),
            Path.GetFullPath(environmentFile),
            schemaScript is null ? null : Path.GetFullPath(schemaScript),
            commit,
            schemaOnly,
            verifyOnly);
    }
}
