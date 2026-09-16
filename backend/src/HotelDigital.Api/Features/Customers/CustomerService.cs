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
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        page = Paging.NormalizePage(page);
        pageSize = Paging.NormalizePageSize(pageSize);
        var query = db.Customers.AsNoTracking();

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

    private static CustomerDetail ToDetail(Customer customer) => new(
        customer.CustomerId,
        customer.FullName,
        customer.Phone,
        customer.Email,
        customer.IdentityDocument,
        customer.Nationality,
        customer.Note,
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
        return [.. fields];
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
