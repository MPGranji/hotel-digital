"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataMessage, PageHeader, Panel } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { deleteBooking, getBookingOptions, getBookings } from "@/features/bookings/bookings-api";
import type { BookingListItem, BookingOptions } from "@/features/bookings/types";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { PagedResult } from "@/types/api";

export interface LedgerFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  roomId: string;
  channelId: string;
  status: string;
}

const emptyOptions: BookingOptions = { rooms: [], channels: [] };

export function LedgerScreen({ initialFilters }: Readonly<{ initialFilters: LedgerFilters }>) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [options, setOptions] = useState<BookingOptions>(emptyOptions);
  const [result, setResult] = useState<PagedResult<BookingListItem>>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [deletingId, setDeletingId] = useState<number>();
  const [reloadKey, setReloadKey] = useState(0);

  const requestParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return params;
  }, [filters, page]);
  const requestKey = requestParams.toString();

  useEffect(() => {
    void getBookingOptions().then(setOptions);
  }, []);

  useEffect(() => {
    let active = true;
    void getBookings(new URLSearchParams(requestKey))
      .then((data) => { if (active) setResult(data); })
      .catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải sổ đặt phòng.")))
      .finally(() => setLoading(false));
    return () => { active = false; };
  }, [reloadKey, requestKey]);

  function applyFilters() {
    setPage(1);
    setFilters(draft);
    setLoading(true);
    setError(undefined);
    const params = new URLSearchParams();
    Object.entries(draft).forEach(([key, value]) => { if (value) params.set(key, value); });
    router.replace(params.size ? `/ledger?${params}` : "/ledger", { scroll: false });
  }

  function resetFilters() {
    const cleared: LedgerFilters = { search: "", dateFrom: "", dateTo: "", roomId: "", channelId: "", status: "" };
    setDraft(cleared);
    setFilters(cleared);
    setPage(1);
    setLoading(true);
    setError(undefined);
    router.replace("/ledger", { scroll: false });
  }

  function refresh() {
    setLoading(true);
    setError(undefined);
    setReloadKey((value) => value + 1);
  }

  async function removeBooking(booking: BookingListItem) {
    if (!window.confirm(`Xóa đặt phòng ${booking.bookingCode}? Hành động này không thể hoàn tác.`)) return;
    setDeletingId(booking.id);
    setActionError(undefined);
    try {
      await deleteBooking(booking.id, booking.version);
      if (result?.items.length === 1 && page > 1) {
        setPage((current) => current - 1);
        setLoading(true);
      } else {
        refresh();
      }
    } catch (reason) {
      setActionError(getApiErrorMessage(reason, "Không thể xóa đặt phòng. Vui lòng thử lại."));
    } finally {
      setDeletingId(undefined);
    }
  }

  return (
    <>
      <PageHeader
        actions={<Link className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline focus-visible:outline-2" href="/bookings">Thêm đặt phòng</Link>}
        description="Tìm đặt phòng theo mã, tên khách, số điện thoại hoặc ngày đến."
        title="Sổ đặt phòng"
      />
      <Panel>
        <form className="grid gap-3 border-b border-slate-200 pb-5 md:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => { event.preventDefault(); applyFilters(); }}>
          <Input aria-label="Tìm đặt phòng" onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))} placeholder="Mã đặt phòng, tên khách hoặc SĐT" value={draft.search} />
          <Input aria-label="Từ ngày đến" onChange={(event) => setDraft((current) => ({ ...current, dateFrom: event.target.value }))} title="Từ ngày đến" type="date" value={draft.dateFrom} />
          <Input aria-label="Đến ngày đến" onChange={(event) => setDraft((current) => ({ ...current, dateTo: event.target.value }))} title="Đến ngày đến" type="date" value={draft.dateTo} />
          <Select aria-label="Phòng" onChange={(event) => setDraft((current) => ({ ...current, roomId: event.target.value }))} value={draft.roomId}><option value="">Tất cả phòng</option>{options.rooms.map((room) => <option key={room.id} value={room.id}>{room.roomNumber} · {room.roomTypeName}</option>)}</Select>
          <Select aria-label="Kênh" onChange={(event) => setDraft((current) => ({ ...current, channelId: event.target.value }))} value={draft.channelId}><option value="">Tất cả kênh</option>{options.channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</Select>
          <Select aria-label="Trạng thái" onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} value={draft.status}><option value="">Tất cả trạng thái</option><option value="BOOKED">Đã đặt</option><option value="CHECKED_IN">Đang lưu trú</option><option value="CHECKED_OUT">Đã trả phòng</option><option value="CANCELLED">Đã hủy</option><option value="NO_SHOW">Không đến</option></Select>
          <div className="flex gap-2"><Button className="flex-1" type="submit">Áp dụng</Button><Button className="flex-1" onClick={resetFilters} variant="secondary">Xóa lọc</Button></div>
        </form>

        <div className="mt-5">
          {actionError ? <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{actionError}</p> : null}
          {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Không thể tải dữ liệu" /> : loading ? <DataMessage title="Đang tải sổ đặt phòng…" /> : !result?.items.length ? <DataMessage description="Thử thay đổi bộ lọc hoặc tạo đặt phòng mới." title="Không có đặt phòng phù hợp" /> : (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Mã / Khách</th><th className="px-3 py-3">Nguồn đặt</th><th className="px-3 py-3">Phòng</th><th className="px-3 py-3">Ngày đến</th><th className="px-3 py-3">Ngày đi</th><th className="px-3 py-3 text-right">Tiền phòng</th><th className="px-3 py-3 text-right">Tổng thu</th><th className="px-3 py-3">Thanh toán / Hóa đơn</th><th className="px-3 py-3">Lưu trú</th><th className="px-3 py-3 text-right">Thao tác</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{result.items.map((booking) => <LedgerRow booking={booking} deleting={deletingId === booking.id} key={booking.id} onDelete={removeBooking} />)}</tbody>
                </table>
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-500">{result.totalItems.toLocaleString("vi-VN")} đặt phòng</p><Pagination page={result.page} totalPages={result.totalPages} onPageChange={(next) => { setPage(next); setLoading(true); }} /></div>
            </>
          )}
        </div>
      </Panel>
    </>
  );
}

function LedgerRow({ booking, deleting, onDelete }: Readonly<{ booking: BookingListItem; deleting: boolean; onDelete: (booking: BookingListItem) => void }>) {
  const paymentLabel = booking.grossRevenue <= 0
    ? "Chưa phát sinh"
    : booking.paidAmount >= booking.grossRevenue ? "Đã thanh toán"
      : booking.paidAmount > 0 ? "Đã thanh toán một phần" : "Chưa thanh toán";
  const paymentClass = booking.paidAmount >= booking.grossRevenue && booking.grossRevenue > 0
    ? "text-emerald-700"
    : booking.paidAmount > 0 ? "text-amber-700" : "text-slate-600";
  const sourceLabel = booking.bookingMode === "WALK_IN"
    ? "Tại quầy"
    : booking.channelCategory === "ONLINE" ? "Online" : "Đặt trước";
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-3 py-3"><p className="font-medium text-[var(--primary)]">{booking.bookingCode}</p>{booking.groupCode ? <p className="text-xs font-medium text-blue-700">Nhóm {booking.groupCode}</p> : null}<p className="text-slate-700">{booking.customerName}</p><p className="text-xs text-slate-500">{booking.customerPhone || booking.channelName}</p></td>
      <td className="px-3 py-3"><p className="font-medium text-slate-800">{sourceLabel}</p><p className="text-xs text-slate-500">{booking.channelName}</p></td>
      <td className="px-3 py-3"><p className="font-medium">{booking.roomNumber}</p><p className="text-xs text-slate-500">{booking.roomTypeName} · {booking.billedNights} đêm</p></td>
      <td className="px-3 py-3">{formatDateTime(booking.checkInAt)}</td>
      <td className="px-3 py-3">{formatDateTime(booking.checkOutAt)}</td>
      <td className="px-3 py-3 text-right">{formatCurrency(booking.roomRevenue)}</td>
      <td className="px-3 py-3 text-right font-medium text-[var(--primary)]">{formatCurrency(booking.grossRevenue)}</td>
      <td className="px-3 py-3"><p className={`font-semibold ${paymentClass}`}>{paymentLabel}</p><p className="text-xs text-slate-500">Đã thu {formatCurrency(booking.paidAmount)}</p>{booking.invoiceId ? <Link className="text-xs font-medium text-blue-700 hover:underline" href={`/invoices?invoiceId=${booking.invoiceId}`}>{booking.invoiceNumber} · {booking.invoiceStatus === "ISSUED" ? "Đã phát hành" : booking.invoiceStatus === "VOID" ? "Đã hủy" : "Nháp"}</Link> : <p className="text-xs text-red-600">Chưa có hóa đơn</p>}</td>
      <td className="px-3 py-3"><StatusBadge status={booking.status} /></td>
      <td className="px-3 py-3 text-right">
        <div className="flex justify-end gap-2">
          <Link className="inline-flex min-h-9 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100" href={`/bookings?bookingId=${booking.id}&mode=view`}>Xem</Link>
          <Link className="inline-flex min-h-9 items-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100" href={`/bookings?bookingId=${booking.id}`}>Sửa</Link>
          <Button className="min-h-9 px-3 py-1" disabled={deleting} onClick={() => onDelete(booking)} variant="danger">{deleting ? "Đang xóa…" : "Xóa"}</Button>
        </div>
      </td>
    </tr>
  );
}
