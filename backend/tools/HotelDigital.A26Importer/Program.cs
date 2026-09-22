using System.Text.Json;
using HotelDigital.A26Importer;
using HotelDigital.Api.Data;
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

var dbOptions = new DbContextOptionsBuilder<HotelDbContext>()
    .UseAzureSql(connectionString, options => options.EnableRetryOnFailure())
    .Options;
await using var db = new HotelDbContext(dbOptions);
if (arguments.SchemaScriptPath is not null)
{
    await ApplySqlScriptAsync(db, arguments.SchemaScriptPath, CancellationToken.None);
    Console.WriteLine($"Đã áp dụng schema script: {Path.GetFileName(arguments.SchemaScriptPath)}");
}
if (arguments.VerifyOnly)
{
    await PrintDatabaseFingerprintAsync(db, CancellationToken.None);
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
          (SELECT COUNT_BIG(*) FROM hotel.Invoice invoice LEFT JOIN hotel.Booking booking ON booking.BookingID = invoice.BookingID WHERE booking.BookingID IS NULL) AS OrphanInvoices;
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
            OrphanInvoices = reader.GetInt64(7)
        };
        Console.WriteLine(JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }));
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
