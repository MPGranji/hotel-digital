using HotelDigital.Api.Common;
using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Features.Customers;

public sealed class CustomerService(
    HotelDbContext db,
    IAuditWriter auditWriter,
    ITransactionExecutor transactionExecutor)
{
    private static readonly string[] StayStatuses = ["CHECKED_IN", "CHECKED_OUT"];

    public async Task<PagedResponse<CustomerListItem>> GetPageAsync(
        string? search,
        bool? isActive,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        page = Paging.NormalizePage(page);
        pageSize = Paging.NormalizePageSize(pageSize);
        var query = db.Customers.AsNoTracking();
        if (isActive.HasValue) query = query.Where(x => x.IsActive == isActive.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x =>
                x.FullName.Contains(term)
                || (x.Phone != null && x.Phone.Contains(term))
                || (x.IdentityDocument != null && x.IdentityDocument.Contains(term)));
        }

        var projected = query.Select(x => new
        {
            Customer = x,
            LastCheckInAt = x.Bookings
                .Where(booking => StayStatuses.Contains(booking.Status))
                .Max(booking => (DateTime?)booking.CheckInAt),
            StayCount = x.Bookings.Count(booking => StayStatuses.Contains(booking.Status))
        });
        var totalItems = await projected.LongCountAsync(cancellationToken);
        var rows = await projected
            .OrderByDescending(x => x.LastCheckInAt.HasValue)
            .ThenByDescending(x => x.LastCheckInAt)
            .ThenBy(x => x.Customer.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new CustomerListItem(
                x.Customer.CustomerId,
                x.Customer.FullName,
                x.Customer.Phone,
                x.Customer.Email,
                x.Customer.IdentityDocument,
                x.Customer.Nationality,
                x.Customer.IsActive,
                x.LastCheckInAt,
                x.StayCount,
                Convert.ToBase64String(x.Customer.Version)))
            .ToListAsync(cancellationToken);

        return new PagedResponse<CustomerListItem>(rows, page, pageSize, totalItems);
    }

    public async Task<CustomerDetail> GetAsync(long id, CancellationToken cancellationToken)
    {
        var customer = await db.Customers.AsNoTracking()
            .SingleOrDefaultAsync(x => x.CustomerId == id, cancellationToken)
            ?? throw new ResourceNotFoundException("customer_not_found", "Không tìm thấy khách hàng.");
        return ToDetail(customer);
    }

    public async Task<CustomerDetail> CreateAsync(
        CustomerUpsertRequest request,
        CancellationToken cancellationToken)
    {
        CustomerValidator.Validate(request, requireVersion: false);

        return await transactionExecutor.ExecuteAsync(async token =>
        {
            await EnsureIdentityDocumentAvailableAsync(request.IdentityDocument, null, token);
            var customer = new Customer();
            Apply(customer, request);
            db.Customers.Add(customer);
            await db.SaveChangesAsync(token);

            auditWriter.Add("CREATE", "Customer", customer.CustomerId.ToString(), new
            {
                fields = new[] { "FullName", "Phone", "Email", "IdentityDocument", "Nationality", "Note" }
            });
            await db.SaveChangesAsync(token);
            return ToDetail(customer);
        }, cancellationToken);
    }

    public async Task<CustomerDetail> UpdateAsync(
        long id,
        CustomerUpsertRequest request,
        CancellationToken cancellationToken)
    {
        CustomerValidator.Validate(request, requireVersion: true);
        CustomerValidator.TryDecodeVersion(request.Version, out var version);

        return await transactionExecutor.ExecuteAsync(async token =>
        {
            var customer = await db.Customers.SingleOrDefaultAsync(x => x.CustomerId == id, token)
                ?? throw new ResourceNotFoundException("customer_not_found", "Không tìm thấy khách hàng.");
            db.Entry(customer).Property(x => x.Version).OriginalValue = version;
            await EnsureIdentityDocumentAvailableAsync(request.IdentityDocument, id, token);
            var changedFields = GetChangedFields(customer, request);
            Apply(customer, request);
            auditWriter.Add("UPDATE", "Customer", customer.CustomerId.ToString(), new { fields = changedFields });

            try
            {
                await db.SaveChangesAsync(token);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new ConflictException(
                    "customer_version_conflict",
                    "Khách hàng đã được người khác cập nhật. Vui lòng tải lại trước khi lưu.");
            }

            return ToDetail(customer);
        }, cancellationToken);
    }

    public async Task<IReadOnlyList<CustomerStayItem>> GetStaysAsync(
        long id,
        CancellationToken cancellationToken)
    {
        if (!await db.Customers.AsNoTracking().AnyAsync(x => x.CustomerId == id, cancellationToken))
            throw new ResourceNotFoundException("customer_not_found", "Không tìm thấy khách hàng.");

        return await db.Bookings.AsNoTracking()
            .Where(x => x.CustomerId == id)
            .OrderByDescending(x => x.CheckInAt)
            .Select(x => new CustomerStayItem(
                x.BookingId,
                x.BookingCode,
                x.Room.RoomNumber,
                x.CheckInAt,
                x.CheckOutAt,
                x.Status,
                x.GrossRevenue))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CustomerDuplicateItem>> FindDuplicatesAsync(
        CustomerDuplicateRequest request,
        CancellationToken cancellationToken)
    {
        var candidates = await db.Customers.AsNoTracking()
            .Where(x => x.IsActive && x.CustomerId != request.ExcludeId)
            .Select(x => new
            {
                x.CustomerId, x.FullName, x.Phone, x.Email, x.IdentityDocument,
                StayCount = x.Bookings.Count(booking => StayStatuses.Contains(booking.Status))
            })
            .ToListAsync(cancellationToken);
        var identity = NormalizeToken(request.IdentityDocument);
        var phone = NormalizePhone(request.Phone);
        var email = NormalizeEmail(request.Email);

        return candidates.Select(x =>
        {
            var fields = new List<string>();
            if (identity.Length > 0 && NormalizeToken(x.IdentityDocument) == identity) fields.Add("CCCD/Passport");
            if (phone.Length > 0 && NormalizePhone(x.Phone) == phone) fields.Add("Số điện thoại");
            if (email.Length > 0 && NormalizeEmail(x.Email) == email) fields.Add("Email");
            var strong = fields.Contains("CCCD/Passport");
            var possible = fields.Contains("Số điện thoại") || fields.Contains("Email");
            return new { Customer = x, Fields = fields, Strength = strong ? "STRONG" : possible ? "POSSIBLE" : "NONE" };
        })
        .Where(x => x.Strength != "NONE")
        .OrderBy(x => x.Strength == "STRONG" ? 0 : 1)
        .ThenByDescending(x => x.Fields.Count)
        .Take(10)
        .Select(x => new CustomerDuplicateItem(x.Customer.CustomerId, x.Customer.FullName, x.Customer.Phone, x.Customer.Email, x.Customer.IdentityDocument, x.Strength, x.Fields, x.Customer.StayCount))
        .ToList();
    }

    public async Task<CustomerDetail> MergeAsync(long targetId, long duplicateId, CancellationToken cancellationToken)
    {
        if (targetId == duplicateId)
            throw new RequestValidationException(new Dictionary<string, string[]> { ["duplicateCustomerId"] = ["Hai hồ sơ phải khác nhau."] });

        return await transactionExecutor.ExecuteAsync(async token =>
        {
            var target = await db.Customers.SingleOrDefaultAsync(x => x.CustomerId == targetId, token)
                ?? throw new ResourceNotFoundException("customer_not_found", "Không tìm thấy hồ sơ khách giữ lại.");
            var duplicate = await db.Customers.SingleOrDefaultAsync(x => x.CustomerId == duplicateId, token)
                ?? throw new ResourceNotFoundException("duplicate_customer_not_found", "Không tìm thấy hồ sơ khách cần gộp.");
            if (!duplicate.IsActive)
                throw new BusinessRuleException("customer_already_inactive", "Hồ sơ cần gộp đã ngừng hoạt động.");

            await db.Bookings.Where(x => x.CustomerId == duplicateId)
                .ExecuteUpdateAsync(update => update.SetProperty(x => x.CustomerId, targetId), token);
            target.Phone ??= duplicate.Phone;
            target.Email ??= duplicate.Email;
            target.IdentityDocument ??= duplicate.IdentityDocument;
            target.Nationality ??= duplicate.Nationality;
            target.Note = CombineNotes(target.Note, duplicate.Note);
            target.IsActive = true;
            duplicate.IsActive = false;
            duplicate.Note = CombineNotes(duplicate.Note, $"Đã gộp vào khách hàng ID {targetId}.");
            auditWriter.Add("MERGE", "Customer", targetId.ToString(), new { duplicateCustomerId = duplicateId });
            auditWriter.Add("DEACTIVATE", "Customer", duplicateId.ToString(), new { mergedIntoCustomerId = targetId });
            await db.SaveChangesAsync(token);
            return ToDetail(target);
        }, cancellationToken);
    }

    private static CustomerDetail ToDetail(Customer customer) => new(
        customer.CustomerId,
        customer.FullName,
        customer.Phone,
        customer.Email,
        customer.IdentityDocument,
        customer.Nationality,
        customer.Note,
        customer.IsActive,
        customer.CreatedAt,
        Convert.ToBase64String(customer.Version));

    private static void Apply(Customer customer, CustomerUpsertRequest request)
    {
        customer.FullName = request.FullName.Trim();
        customer.Phone = Clean(request.Phone);
        customer.Email = Clean(request.Email);
        customer.IdentityDocument = Clean(request.IdentityDocument);
        customer.Nationality = Clean(request.Nationality);
        customer.Note = Clean(request.Note);
        customer.IsActive = request.IsActive;
    }

    private static string[] GetChangedFields(Customer current, CustomerUpsertRequest request)
    {
        var fields = new List<string>();
        if (current.FullName != request.FullName.Trim()) fields.Add("FullName");
        if (current.Phone != Clean(request.Phone)) fields.Add("Phone");
        if (current.Email != Clean(request.Email)) fields.Add("Email");
        if (current.IdentityDocument != Clean(request.IdentityDocument)) fields.Add("IdentityDocument");
        if (current.Nationality != Clean(request.Nationality)) fields.Add("Nationality");
        if (current.Note != Clean(request.Note)) fields.Add("Note");
        if (current.IsActive != request.IsActive) fields.Add("IsActive");
        return [.. fields];
    }

    private async Task EnsureIdentityDocumentAvailableAsync(string? identityDocument, long? excludeId, CancellationToken token)
    {
        var normalized = NormalizeToken(identityDocument);
        if (normalized.Length == 0) return;
        var candidates = await db.Customers.AsNoTracking()
            .Where(x => x.IsActive && x.CustomerId != excludeId && x.IdentityDocument != null)
            .Select(x => new { x.CustomerId, x.IdentityDocument })
            .ToListAsync(token);
        var duplicate = candidates.FirstOrDefault(x => NormalizeToken(x.IdentityDocument) == normalized);
        if (duplicate is not null)
            throw new ConflictException("customer_identity_exists", $"CCCD/Passport đã thuộc hồ sơ khách ID {duplicate.CustomerId}. Hãy dùng hồ sơ cũ hoặc gộp khách.");
    }

    private static string CombineNotes(string? first, string? second)
    {
        var parts = new[] { Clean(first), Clean(second) }.Where(x => x is not null).Distinct();
        return string.Join(" | ", parts).Truncate(500);
    }

    private static string NormalizePhone(string? value) => new((value ?? string.Empty).Where(char.IsDigit).ToArray());
    private static string NormalizeEmail(string? value) => Clean(value)?.ToUpperInvariant() ?? string.Empty;
    private static string NormalizeToken(string? value) => new((value ?? string.Empty).Where(char.IsLetterOrDigit).Select(char.ToUpperInvariant).ToArray());
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

internal static class CustomerStringExtensions
{
    public static string Truncate(this string value, int maxLength) => value.Length <= maxLength ? value : value[..maxLength];
}
