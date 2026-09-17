using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Features.Invoices;

public sealed class InvoiceService(HotelDbContext db, IAuditWriter auditWriter, ITransactionExecutor transactionExecutor)
{
    private static readonly string[] Statuses = ["DRAFT", "ISSUED", "VOID"];

    public async Task<IReadOnlyList<InvoiceItem>> GetAsync(string? search, string? status, CancellationToken token)
    {
        var query = db.Invoices.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => x.InvoiceNumber.Contains(term) || x.Booking.BookingCode.Contains(term) || x.Booking.Customer.FullName.Contains(term));
        }
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status.Trim().ToUpperInvariant());
        var rows = await query.Include(x => x.Booking).ThenInclude(x => x.Customer)
            .Include(x => x.Booking).ThenInclude(x => x.Room)
            .OrderByDescending(x => x.CreatedAt).Take(500).ToListAsync(token);
        return rows.Select(ToItem).ToList();
    }

    public async Task<InvoiceItem> CreateAsync(InvoiceWriteRequest request, CancellationToken token)
    {
        Validate(request, false);
        return await transactionExecutor.ExecuteAsync(async ct =>
        {
            var booking = await db.Bookings.SingleOrDefaultAsync(x => x.BookingId == request.BookingId, ct)
                ?? throw new ResourceNotFoundException("booking_not_found", "Không tìm thấy booking để lập hóa đơn.");
            if (await db.Invoices.AnyAsync(x => x.BookingId == request.BookingId, ct))
                throw new ConflictException("booking_invoice_exists", "Booking này đã có hóa đơn.");
            var number = Clean(request.InvoiceNumber) ?? $"INV-{DateTime.Now:yyyyMMdd}-{booking.BookingId:000000}";
            await EnsureNumberUniqueAsync(number, null, ct);
            var invoice = new Invoice { BookingId = booking.BookingId, InvoiceNumber = number };
            Apply(invoice, booking, request);
            db.Invoices.Add(invoice);
            booking.InvoiceNumber = number;
            await SaveAsync(ct);
            auditWriter.Add("CREATE", "Invoice", invoice.InvoiceId.ToString(), new { invoice.InvoiceNumber, invoice.BookingId, invoice.Status });
            await db.SaveChangesAsync(ct);
            return await GetOneAsync(invoice.InvoiceId, ct);
        }, token);
    }

    public async Task<InvoiceItem> UpdateAsync(long id, InvoiceWriteRequest request, CancellationToken token)
    {
        Validate(request, true);
        if (!TryDecodeVersion(request.Version, out var version))
            throw new RequestValidationException(new Dictionary<string, string[]> { ["version"] = ["Phiên bản hóa đơn không hợp lệ."] });
        return await transactionExecutor.ExecuteAsync(async ct =>
        {
            var invoice = await db.Invoices.Include(x => x.Booking).SingleOrDefaultAsync(x => x.InvoiceId == id, ct)
                ?? throw new ResourceNotFoundException("invoice_not_found", "Không tìm thấy hóa đơn.");
            db.Entry(invoice).Property(x => x.Version).OriginalValue = version;
            if (request.BookingId != invoice.BookingId)
                throw new BusinessRuleException("invoice_booking_locked", "Không thể đổi booking của hóa đơn đã tạo.");
            var nextStatus = request.Status.Trim().ToUpperInvariant();
            if (invoice.Status == "VOID" && nextStatus != "VOID")
                throw new BusinessRuleException("invoice_is_void", "Hóa đơn đã hủy không thể khôi phục trạng thái.");
            if (invoice.Status == "ISSUED" && nextStatus == "DRAFT")
                throw new BusinessRuleException("invoice_already_issued", "Hóa đơn đã phát hành không thể chuyển lại thành nháp.");
            var number = Clean(request.InvoiceNumber) ?? invoice.InvoiceNumber;
            await EnsureNumberUniqueAsync(number, id, ct);
            invoice.InvoiceNumber = number;
            Apply(invoice, invoice.Booking, request);
            invoice.Booking.InvoiceNumber = number;
            auditWriter.Add("UPDATE", "Invoice", id.ToString(), new { invoice.InvoiceNumber, invoice.Status });
            try { await SaveAsync(ct); }
            catch (DbUpdateConcurrencyException) { throw new ConflictException("invoice_version_conflict", "Hóa đơn đã được cập nhật. Vui lòng tải lại."); }
            return await GetOneAsync(id, ct);
        }, token);
    }

    private static void Apply(Invoice invoice, Booking booking, InvoiceWriteRequest request)
    {
        var status = request.Status.Trim().ToUpperInvariant();
        invoice.Status = status;
        if (status == "ISSUED" && invoice.IssuedAt is null) invoice.IssuedAt = DateTime.Now;
        invoice.GrossAmount = booking.GrossRevenue;
        invoice.PaidAmount = booking.PaidAmount;
        invoice.DebtAmount = booking.DebtAmount;
        invoice.BalanceDue = booking.BalanceDue;
        invoice.Note = Clean(request.Note);
    }

    private async Task<InvoiceItem> GetOneAsync(long id, CancellationToken token)
    {
        var invoice = await db.Invoices.AsNoTracking().Include(x => x.Booking).ThenInclude(x => x.Customer)
            .Include(x => x.Booking).ThenInclude(x => x.Room).SingleAsync(x => x.InvoiceId == id, token);
        return ToItem(invoice);
    }

    private async Task EnsureNumberUniqueAsync(string number, long? excludeId, CancellationToken token)
    {
        if (await db.Invoices.AsNoTracking().AnyAsync(x => x.InvoiceNumber == number && x.InvoiceId != excludeId, token))
            throw new ConflictException("invoice_number_exists", "Số hóa đơn đã được sử dụng.");
    }

    private static void Validate(InvoiceWriteRequest request, bool requireVersion)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.BookingId <= 0) errors["bookingId"] = ["Vui lòng chọn booking."];
        if (!Statuses.Contains(request.Status?.Trim().ToUpperInvariant())) errors["status"] = ["Trạng thái hóa đơn không hợp lệ."];
        if (request.InvoiceNumber?.Trim().Length > 50) errors["invoiceNumber"] = ["Số hóa đơn tối đa 50 ký tự."];
        if (request.Note?.Trim().Length > 500) errors["note"] = ["Ghi chú tối đa 500 ký tự."];
        if (requireVersion && !TryDecodeVersion(request.Version, out _)) errors["version"] = ["Phiên bản hóa đơn không hợp lệ."];
        if (errors.Count > 0) throw new RequestValidationException(errors);
    }

    private async Task SaveAsync(CancellationToken token)
    {
        try { await db.SaveChangesAsync(token); }
        catch (DbUpdateException exception) when (FindSqlException(exception)?.Number is 2601 or 2627)
        { throw new ConflictException("invoice_exists", "Booking hoặc số hóa đơn đã được sử dụng."); }
    }

    private static InvoiceItem ToItem(Invoice x) => new(
        x.InvoiceId, x.BookingId, x.Booking.BookingCode, x.Booking.Customer.FullName, x.Booking.Room.RoomNumber,
        x.InvoiceNumber, x.IssuedAt, x.Status, x.GrossAmount, x.PaidAmount, x.DebtAmount,
        x.Note, x.CreatedAt, Convert.ToBase64String(x.Version));

    private static bool TryDecodeVersion(string? value, out byte[] version)
    {
        version = [];
        try { if (string.IsNullOrWhiteSpace(value)) return false; version = Convert.FromBase64String(value); return version.Length == 8; }
        catch (FormatException) { return false; }
    }

    private static SqlException? FindSqlException(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
            if (current is SqlException sqlException) return sqlException;
        return null;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
