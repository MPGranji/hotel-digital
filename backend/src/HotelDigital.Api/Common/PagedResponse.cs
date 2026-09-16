namespace HotelDigital.Api.Common;

public sealed record PagedResponse<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    long TotalItems)
{
    public int TotalPages => TotalItems == 0 ? 0 : (int)Math.Ceiling(TotalItems / (double)PageSize);
}

public static class Paging
{
    public static int NormalizePage(int page) => Math.Max(page, 1);
    public static int NormalizePageSize(int pageSize) => Math.Clamp(pageSize, 1, 100);
}
