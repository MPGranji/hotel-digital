using HotelDigital.Api.Data;
using HotelDigital.Api.Data.Entities;
using HotelDigital.Api.Infrastructure.Auditing;
using HotelDigital.Api.Infrastructure.Errors;
using HotelDigital.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HotelDigital.Api.Features.Payments;

public sealed class PaymentService(
    HotelDbContext db,
    IAuditWriter auditWriter,
    ITransactionExecutor transactionExecutor)
{
    private static readonly string[] Methods = ["CASH", "CARD", "TRANSFER"];

    public async Task<IReadOnlyList<PaymentItem>> GetAsync(long bookingId, CancellationToken token) =>
        await db.Payments.AsNoTracking()
            .Where(x => x.BookingId == bookingId)
            .OrderByDescending(x => x.PaidAt)
            .ThenByDescending(x => x.PaymentId)
            .Select(x => new PaymentItem(
                x.PaymentId,
                x.BookingId,
                x.Amount,
                x.Method,
                x.PaidAt,
                x.ReferenceCode,
                x.Note,
                Convert.ToBase64String(x.Version)))
            .ToListAsync(token);

    public async Task<PaymentItem> CreateAsync(long bookingId, PaymentWriteRequest request, CancellationToken token)
    {
        Validate(request);
        return await transactionExecutor.ExecuteAsync(async cancellationToken =>
        {
            var booking = await db.Bookings.SingleOrDefaultAsync(x => x.BookingId == bookingId, cancellationToken)
                ?? throw new ResourceNotFoundException("booking_not_found", "Không tìm thấy booking để ghi nhận thanh toán.");
            if (booking.Status is "CHECKED_OUT" or "CANCELLED" or "NO_SHOW")
                throw new BusinessRuleException("booking_is_closed", "Booking đã kết thúc hoặc đã hủy nên không thể ghi nhận thêm thanh toán.");

            var payment = new Payment
            {
                BookingId = bookingId,
                Amount = request.Amount,
                Method = request.Method.Trim().ToUpperInvariant(),
                PaidAt = request.PaidAt ?? DateTime.Now,
                ReferenceCode = Clean(request.ReferenceCode),
                Note = Clean(request.Note)
            };
            db.Payments.Add(payment);
            await db.SaveChangesAsync(cancellationToken);
            await SyncLegacyTotalsAsync(booking, cancellationToken);
            auditWriter.Add("CREATE", "Payment", payment.PaymentId.ToString(), new
            {
                payment.BookingId,
                payment.Amount,
                payment.Method,
                payment.PaidAt,
                payment.ReferenceCode
            });
            await db.SaveChangesAsync(cancellationToken);
            return ToItem(payment);
        }, token);
    }

    private async Task SyncLegacyTotalsAsync(Booking booking, CancellationToken token)
    {
        var totals = await db.Payments.AsNoTracking()
            .Where(x => x.BookingId == booking.BookingId)
            .GroupBy(x => x.Method)
            .Select(group => new { Method = group.Key, Amount = group.Sum(x => x.Amount) })
            .ToDictionaryAsync(x => x.Method, x => x.Amount, token);
        booking.CashAmount = totals.GetValueOrDefault("CASH");
        booking.CardAmount = totals.GetValueOrDefault("CARD");
        booking.TransferAmount = totals.GetValueOrDefault("TRANSFER");
    }

    private static void Validate(PaymentWriteRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        var method = request.Method?.Trim().ToUpperInvariant();
        if (request.Amount <= 0) errors["amount"] = ["Số tiền thanh toán phải lớn hơn 0."];
        if (!Methods.Contains(method)) errors["method"] = ["Phương thức thanh toán không hợp lệ."];
        if (request.ReferenceCode?.Trim().Length > 100) errors["referenceCode"] = ["Mã giao dịch tối đa 100 ký tự."];
        if (request.Note?.Trim().Length > 300) errors["note"] = ["Ghi chú tối đa 300 ký tự."];
        if (errors.Count > 0) throw new RequestValidationException(errors);
    }

    private static PaymentItem ToItem(Payment x) => new(
        x.PaymentId,
        x.BookingId,
        x.Amount,
        x.Method,
        x.PaidAt,
        x.ReferenceCode,
        x.Note,
        Convert.ToBase64String(x.Version));

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
