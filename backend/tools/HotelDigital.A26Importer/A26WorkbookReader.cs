using System.Globalization;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using ClosedXML.Excel;

namespace HotelDigital.A26Importer;

public sealed class A26WorkbookReader
{
    private const string SheetName = "A26 Pham Ngu Lao";
    private static readonly string[] DateFormats = ["dd/MM/yy HH:mm", "dd/MM/yyyy HH:mm"];
    private static readonly HashSet<string> SupportedChannelCodes =
        ["DIRECT", "ONLINE", "TRAVEL_AGENT", "COMPANY"];

    private static readonly string[] RequiredHeaders =
    [
        "Mã đặt phòng", "Loại phòng", "Tên phòng", "Tên khách", "Ngày đến", "Ngày đi",
        "Tiền phòng", "Dịch vụ", "Tổng doanh thu", "Nợ trước", "Tiền mặt", "Thẻ tín dụng",
        "Chuyển khoản", "Công nợ", "Còn thiếu", "SĐT", "Email", "CMND/Hộ chiếu",
        "Nguồn", "Trạng thái", "Số hóa đơn", "Mã CMS", "Số đêm"
    ];

    public A26ImportPlan Read(string filePath)
    {
        var fullPath = Path.GetFullPath(filePath);
        if (!File.Exists(fullPath)) throw new FileNotFoundException("Không tìm thấy file Excel A26.", fullPath);
        if (!string.Equals(Path.GetExtension(fullPath), ".xlsx", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Importer chỉ nhận file .xlsx.");

        var hash = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(fullPath))).ToLowerInvariant();
        using var workbook = new XLWorkbook(fullPath);
        if (!workbook.TryGetWorksheet(SheetName, out var worksheet))
            throw new InvalidOperationException($"Không tìm thấy sheet '{SheetName}'.");

        var headerRow = FindHeaderRow(worksheet);
        var columns = GetColumns(headerRow);
        var missingHeaders = RequiredHeaders.Where(header => !columns.ContainsKey(header)).ToArray();
        if (missingHeaders.Length > 0)
            throw new InvalidOperationException($"Thiếu cột bắt buộc: {string.Join(", ", missingHeaders)}.");

        var rows = new List<A26ImportRow>();
        var issues = new List<A26ImportIssue>();
        var totalRows = 0;
        var settledRows = 0;
        var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? headerRow.RowNumber();

        for (var rowNumber = headerRow.RowNumber() + 1; rowNumber <= lastRow; rowNumber++)
        {
            var row = worksheet.Row(rowNumber);
            var legacyCode = Text(row, columns, "Mã đặt phòng");
            if (string.IsNullOrWhiteSpace(legacyCode)) continue;
            totalRows++;

            var invoiceNumber = Text(row, columns, "Số hóa đơn");
            var status = Text(row, columns, "Trạng thái");
            if (string.IsNullOrWhiteSpace(invoiceNumber))
            {
                issues.Add(Error(rowNumber, null, "missing_settlement_code", "Thiếu Số hóa đơn (mã chốt tiền)."));
                continue;
            }

            if (!string.Equals(status, "CHECKOUT", StringComparison.OrdinalIgnoreCase)) continue;
            settledRows++;

            var rowIssues = new List<A26ImportIssue>();
            var roomTypeCode = RequiredText(row, columns, "Loại phòng", invoiceNumber, rowIssues);
            var roomNumber = RequiredText(row, columns, "Tên phòng", invoiceNumber, rowIssues);
            var customerName = Text(row, columns, "Tên khách");
            if (string.IsNullOrWhiteSpace(customerName))
            {
                customerName = "Chưa xác định";
                rowIssues.Add(Warning(rowNumber, invoiceNumber, "missing_customer_name", "Tên khách trống; dùng hồ sơ 'Chưa xác định'."));
            }

            var checkInAt = Date(row, columns, "Ngày đến", invoiceNumber, rowIssues);
            var checkOutAt = Date(row, columns, "Ngày đi", invoiceNumber, rowIssues);
            var roomRevenue = Amount(row, columns, "Tiền phòng", invoiceNumber, rowIssues);
            var serviceRevenue = Amount(row, columns, "Dịch vụ", invoiceNumber, rowIssues);
            var grossRevenue = Amount(row, columns, "Tổng doanh thu", invoiceNumber, rowIssues);
            var previousDebt = Amount(row, columns, "Nợ trước", invoiceNumber, rowIssues);
            var cashAmount = Amount(row, columns, "Tiền mặt", invoiceNumber, rowIssues);
            var cardAmount = Amount(row, columns, "Thẻ tín dụng", invoiceNumber, rowIssues);
            var transferAmount = Amount(row, columns, "Chuyển khoản", invoiceNumber, rowIssues);
            var debtAmount = Amount(row, columns, "Công nợ", invoiceNumber, rowIssues);
            var balanceDue = Amount(row, columns, "Còn thiếu", invoiceNumber, rowIssues);
            var billedNights = Nights(row, columns, invoiceNumber, rowIssues);

            if (checkInAt.HasValue && checkOutAt.HasValue && checkOutAt <= checkInAt)
                rowIssues.Add(Error(rowNumber, invoiceNumber, "invalid_date_order", "Ngày đi phải sau ngày đến."));

            var monetaryValues = new Dictionary<string, decimal?>
            {
                ["Tiền phòng"] = roomRevenue,
                ["Dịch vụ"] = serviceRevenue,
                ["Tổng doanh thu"] = grossRevenue,
                ["Nợ trước"] = previousDebt,
                ["Tiền mặt"] = cashAmount,
                ["Thẻ tín dụng"] = cardAmount,
                ["Chuyển khoản"] = transferAmount,
                ["Công nợ"] = debtAmount,
                ["Còn thiếu"] = balanceDue
            };
            foreach (var value in monetaryValues.Where(item => item.Value < 0))
                rowIssues.Add(Error(rowNumber, invoiceNumber, "negative_amount", $"{value.Key} không được âm."));

            var phone = OptionalText(row, columns, "SĐT");
            var email = OptionalText(row, columns, "Email");
            var identityDocument = OptionalText(row, columns, "CMND/Hộ chiếu");
            if (email is not null && !MailAddress.TryCreate(email, out _))
                rowIssues.Add(Error(rowNumber, invoiceNumber, "invalid_email", "Email không đúng định dạng."));

            var source = OptionalText(row, columns, "Nguồn");
            string? channelCode = null;
            if (source is null || string.Equals(source, "UNKNOWN", StringComparison.OrdinalIgnoreCase))
            {
                rowIssues.Add(Error(rowNumber, invoiceNumber, "missing_channel", "Nguồn trống hoặc UNKNOWN; dòng không được nhập."));
            }
            else
            {
                channelCode = NormalizeChannelCode(source);
                if (!SupportedChannelCodes.Contains(channelCode))
                {
                    rowIssues.Add(Error(rowNumber, invoiceNumber, "unsupported_channel", $"Nguồn '{source}' không thuộc danh mục kênh được hỗ trợ."));
                    channelCode = null;
                }
            }

            issues.AddRange(rowIssues);
            if (roomTypeCode is null || roomNumber is null || !checkInAt.HasValue || !checkOutAt.HasValue
                || !roomRevenue.HasValue || !serviceRevenue.HasValue || !grossRevenue.HasValue
                || !previousDebt.HasValue || !cashAmount.HasValue || !cardAmount.HasValue
                || !transferAmount.HasValue || !debtAmount.HasValue || !balanceDue.HasValue || !billedNights.HasValue
                || channelCode is null)
            {
                continue;
            }

            var difference = roomRevenue.Value + serviceRevenue.Value - grossRevenue.Value;
            var discountAmount = difference > 0 ? difference : 0;
            var surchargeAmount = difference < 0 ? -difference : 0;
            var calculatedBalance = grossRevenue.Value + previousDebt.Value
                - cashAmount.Value - cardAmount.Value - transferAmount.Value - debtAmount.Value;
            if (Math.Abs(calculatedBalance - balanceDue.Value) > 0.01m)
                issues.Add(Error(rowNumber, invoiceNumber, "balance_mismatch", "Cột Còn thiếu không khớp doanh thu và thanh toán."));

            rows.Add(new A26ImportRow(
                rowNumber,
                legacyCode,
                roomTypeCode,
                roomNumber,
                customerName.Trim(),
                checkInAt.Value,
                checkOutAt.Value,
                roomRevenue.Value,
                serviceRevenue.Value,
                surchargeAmount,
                discountAmount,
                previousDebt.Value,
                cashAmount.Value,
                cardAmount.Value,
                transferAmount.Value,
                debtAmount.Value,
                balanceDue.Value,
                phone,
                email,
                identityDocument,
                channelCode,
                invoiceNumber,
                OptionalText(row, columns, "Mã CMS"),
                billedNights.Value));
        }

        AddDuplicateIssues(rows, issues);
        AddOverlapIssues(rows, issues);
        return new A26ImportPlan(Path.GetFileName(fullPath), hash, totalRows, settledRows, rows, issues);
    }

    private static IXLRow FindHeaderRow(IXLWorksheet worksheet)
    {
        var row = worksheet.RowsUsed()
            .FirstOrDefault(candidate => candidate.CellsUsed().Any(cell => cell.GetString().Trim() == "Mã đặt phòng"));
        return row ?? throw new InvalidOperationException("Không tìm thấy dòng header 'Mã đặt phòng'.");
    }

    private static Dictionary<string, int> GetColumns(IXLRow headerRow) => headerRow.CellsUsed()
        .Select(cell => new { Header = cell.GetString().Trim(), Column = cell.Address.ColumnNumber })
        .Where(item => !string.IsNullOrWhiteSpace(item.Header))
        .ToDictionary(item => item.Header, item => item.Column, StringComparer.OrdinalIgnoreCase);

    private static string Text(IXLRow row, IReadOnlyDictionary<string, int> columns, string header) =>
        row.Cell(columns[header]).GetString().Trim();

    private static string? OptionalText(IXLRow row, IReadOnlyDictionary<string, int> columns, string header)
    {
        var value = Text(row, columns, header);
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private static string? RequiredText(
        IXLRow row,
        IReadOnlyDictionary<string, int> columns,
        string header,
        string invoiceNumber,
        ICollection<A26ImportIssue> issues)
    {
        var value = OptionalText(row, columns, header);
        if (value is null) issues.Add(Error(row.RowNumber(), invoiceNumber, "missing_required_value", $"{header} không được để trống."));
        return value;
    }

    private static DateTime? Date(
        IXLRow row,
        IReadOnlyDictionary<string, int> columns,
        string header,
        string invoiceNumber,
        ICollection<A26ImportIssue> issues)
    {
        var cell = row.Cell(columns[header]);
        if (cell.TryGetValue<DateTime>(out var date)) return date;
        if (DateTime.TryParseExact(cell.GetString().Trim(), DateFormats, CultureInfo.InvariantCulture,
                DateTimeStyles.None, out date)) return date;
        issues.Add(Error(row.RowNumber(), invoiceNumber, "invalid_date", $"{header} không đúng định dạng."));
        return null;
    }

    private static decimal? Amount(
        IXLRow row,
        IReadOnlyDictionary<string, int> columns,
        string header,
        string invoiceNumber,
        ICollection<A26ImportIssue> issues)
    {
        var cell = row.Cell(columns[header]);
        if (cell.TryGetValue<decimal>(out var amount)) return amount;
        var text = cell.GetString().Trim();
        if (decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out amount)
            || decimal.TryParse(text, NumberStyles.Number, CultureInfo.GetCultureInfo("vi-VN"), out amount)) return amount;
        issues.Add(Error(row.RowNumber(), invoiceNumber, "invalid_amount", $"{header} phải là số."));
        return null;
    }

    private static short? Nights(
        IXLRow row,
        IReadOnlyDictionary<string, int> columns,
        string invoiceNumber,
        ICollection<A26ImportIssue> issues)
    {
        var value = Amount(row, columns, "Số đêm", invoiceNumber, issues);
        if (!value.HasValue) return null;
        if (value < 1 || value > short.MaxValue || value != decimal.Truncate(value.Value))
        {
            issues.Add(Error(row.RowNumber(), invoiceNumber, "invalid_nights", "Số đêm phải là số nguyên dương."));
            return null;
        }
        return (short)value.Value;
    }

    private static void AddDuplicateIssues(IReadOnlyList<A26ImportRow> rows, ICollection<A26ImportIssue> issues)
    {
        foreach (var group in rows.GroupBy(row => row.InvoiceNumber, StringComparer.OrdinalIgnoreCase).Where(group => group.Count() > 1))
            foreach (var row in group)
                issues.Add(Error(row.SourceRow, row.InvoiceNumber, "duplicate_settlement_code", "Số hóa đơn (mã chốt tiền) bị trùng trong file."));
    }

    private static void AddOverlapIssues(IReadOnlyList<A26ImportRow> rows, ICollection<A26ImportIssue> issues)
    {
        var reported = new HashSet<int>();
        foreach (var group in rows.Where(row => !string.Equals(row.RoomNumber, "MB-PNL", StringComparison.OrdinalIgnoreCase))
                     .GroupBy(row => row.RoomNumber, StringComparer.OrdinalIgnoreCase))
        {
            var ordered = group.OrderBy(row => row.CheckInAt).ToArray();
            for (var current = 0; current < ordered.Length; current++)
            for (var next = current + 1; next < ordered.Length && ordered[next].CheckInAt < ordered[current].CheckOutAt; next++)
            {
                foreach (var row in new[] { ordered[current], ordered[next] }.Where(row => reported.Add(row.SourceRow)))
                    issues.Add(Error(row.SourceRow, row.InvoiceNumber, "room_overlap", $"Phòng {row.RoomNumber} bị trùng thời gian với dòng khác."));
            }
        }
    }

    private static string NormalizeChannelCode(string source)
    {
        if (string.Equals(source, "Công ty", StringComparison.OrdinalIgnoreCase)) return "COMPANY";
        var normalized = source.Trim().ToUpperInvariant();
        var builder = new StringBuilder(normalized.Length);
        foreach (var character in normalized)
            builder.Append(char.IsLetterOrDigit(character) ? character : '_');
        return builder.ToString().Trim('_') switch
        {
            "BOOKED_CTV" => "DIRECT",
            "ONLINE" => "ONLINE",
            "OTA" => "ONLINE",
            "BOOKED_TA" => "TRAVEL_AGENT",
            var code => code
        };
    }

    private static A26ImportIssue Error(int row, string? invoice, string code, string message) =>
        new(row, invoice, code, message, true);

    private static A26ImportIssue Warning(int row, string? invoice, string code, string message) =>
        new(row, invoice, code, message, false);
}
