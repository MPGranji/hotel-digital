"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { changeBookingStatus, getBooking } from "@/features/bookings/bookings-api";
import type { BookingDetail, BookingListItem } from "@/features/bookings/types";
import { getApiErrorMessage } from "@/lib/api-client";
import { useLiveRevision } from "@/features/realtime/live-updates-provider";
import { formatCurrency, formatDateTime } from "@/lib/format";

type Action = "check-in" | "check-out" | "no-show" | "cancel";

const actionLabels: Record<Action, string> = {
  "check-in": "Xác nhận nhận phòng",
  "check-out": "Xác nhận trả phòng",
  "no-show": "Đánh dấu không đến",
  cancel: "Hủy đặt phòng",
};

export function BookingOperationDrawer({ booking, hotelDate, hotelNow, onChanged, onClose }: Readonly<{
  booking: BookingListItem;
  hotelDate: string;
  hotelNow: string;
  onChanged: (message: string) => void;
  onClose: () => void;
}>) {
  const liveRevision = useLiveRevision();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<BookingDetail>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [pendingAction, setPendingAction] = useState<Action>();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  useEffect(() => {
    if (pendingAction) dialogRef.current?.querySelector<HTMLButtonElement>("[data-confirm-action]")?.focus();
  }, [pendingAction]);

  useEffect(() => {
    let active = true;
    void getBooking(booking.id)
      .then((result) => { if (active) { setDetail(result); setError(undefined); } })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, "Không thể tải chi tiết đặt phòng.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [booking.id, reloadKey, liveRevision]);

  const amount = detail ? Math.max(0, detail.previousDebt + detail.grossRevenue - detail.paidAmount - detail.debtAmount) : 0;
  const canCheckIn = detail?.status === "BOOKED" && detail.checkInAt.slice(0, 10) <= hotelDate && detail.checkOutAt > hotelNow;
  const canCheckOut = detail?.status === "CHECKED_IN" && amount === 0;

  async function applyAction() {
    if (!detail || !pendingAction) return;
    setSaving(true);
    setError(undefined);
    try {
      await changeBookingStatus(detail.id, pendingAction, detail.version);
      onChanged(`${actionLabels[pendingAction]} ${detail.bookingCode} thành công.`);
      onClose();
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Không thể cập nhật booking. Vui lòng tải lại và thử lại."));
      setPendingAction(undefined);
    } finally {
      setSaving(false);
    }
  }

  return <dialog aria-label={`Xử lý ${detail?.bookingCode ?? booking.bookingCode}`} className="booking-operation-dialog flex flex-col" onCancel={(event) => { if (saving) event.preventDefault(); }} onClose={onClose} ref={dialogRef}>
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-5 sm:px-6">
      <div><p className="text-xs font-semibold tracking-wide text-[var(--muted)]">{detail?.bookingCode ?? booking.bookingCode}</p><h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--foreground)]">{detail?.customerName ?? booking.customerName}</h2><p className="mt-1 text-sm text-[var(--muted)]">Phòng {detail?.roomNumber ?? booking.roomNumber} · {detail?.roomTypeName ?? booking.roomTypeName}</p></div>
      <button aria-label="Đóng chi tiết" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-muted)]" disabled={saving} onClick={onClose} type="button"><X aria-hidden="true" size={19} /></button>
    </div>

    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
      {error ? <p className="rounded-lg border border-[#dfc0b9] bg-[#f9efec] px-4 py-3 text-sm text-[#8c493e]" role="alert">{error}</p> : null}
      {loading ? <div aria-label="Đang tải chi tiết" className="space-y-3" role="status"><div className="h-20 animate-pulse rounded-lg bg-[var(--surface-muted)]" /><div className="h-40 animate-pulse rounded-lg bg-[var(--surface-muted)]" /></div> : !detail ? <Button onClick={() => { setLoading(true); setReloadKey((value) => value + 1); }} variant="secondary">Tải lại chi tiết</Button> : <>
        <div className="flex items-center justify-between gap-3"><span className="text-sm text-[var(--muted)]">Trạng thái lưu trú</span><StatusBadge status={detail.status} /></div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--sidebar)] p-4">
          <h3 className="text-base font-bold text-[var(--foreground)]">Thông tin lưu trú</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Ngày giờ đến" value={formatDateTime(detail.checkInAt)} />
            <Info label="Ngày giờ đi" value={formatDateTime(detail.checkOutAt)} />
            <Info label="Kênh đặt" value={detail.channelName} />
            <Info label="Số khách trong phòng" value={detail.guestCount?.toString() ?? "Chưa ghi"} />
            {booking.customerPhone ? <Info label="Số điện thoại" value={booking.customerPhone} /> : null}
            {detail.groupCode ? <Info label="Nhóm booking" value={detail.groupCode} /> : null}
          </dl>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="text-base font-bold text-[var(--foreground)]">Thanh toán</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Money label="Tổng tiền phát sinh" value={detail.grossRevenue} />
            {detail.previousDebt > 0 ? <Money label="Nợ trước" value={detail.previousDebt} /> : null}
            <Money label="Đã thu" value={detail.paidAmount} />
            {detail.debtAmount > 0 ? <Money label="Đã ghi công nợ" value={detail.debtAmount} /> : null}
            <div className="flex justify-between border-t border-[var(--border)] pt-3 font-semibold"><dt>Còn phải thu</dt><dd className={amount > 0 ? "text-[#8a5a2f]" : "text-[var(--foreground)]"}>{formatCurrency(amount)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-[var(--muted)]">Hóa đơn: {detail.invoiceStatus === "ISSUED" ? "Đã phát hành" : detail.invoiceStatus === "VOID" ? "Đã hủy" : detail.invoiceStatus === "DRAFT" ? "Bản nháp" : "Chưa có"}</p>
        </div>
        {detail.note ? <div><h3 className="text-sm font-semibold">Ghi chú</h3><p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">{detail.note}</p></div> : null}
      </>}
    </div>

    {detail ? <div className="space-y-3 border-t border-[var(--border)] bg-white px-5 py-4 sm:px-6">
      {pendingAction ? <div aria-label={actionLabels[pendingAction]} className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-muted)] p-4" role="group"><p className="text-sm font-semibold">{actionLabels[pendingAction]} cho {detail.bookingCode}?</p><p className="mt-1 text-sm text-[var(--muted)]">{pendingAction === "check-out" ? `Hóa đơn nháp sẽ được phát hành. Phòng vẫn giữ lịch đến ${formatDateTime(detail.checkOutAt)}; muốn mở phòng sớm thì sửa giờ đi và tiền phòng trước.` : pendingAction === "cancel" || pendingAction === "no-show" ? "Lịch sử đặt phòng vẫn được giữ lại." : `Xác nhận khách đã nhận phòng ${detail.roomNumber}.`}</p><div className="mt-4 flex gap-2"><Button data-confirm-action disabled={saving} onClick={() => void applyAction()} variant={pendingAction === "cancel" || pendingAction === "no-show" ? "danger" : "primary"}>{saving ? "Đang xử lý…" : "Xác nhận"}</Button><Button disabled={saving} onClick={() => setPendingAction(undefined)} variant="secondary">Quay lại</Button></div></div> : <>
        {detail.status === "BOOKED" ? <><Button className="w-full" disabled={!canCheckIn || saving} onClick={() => setPendingAction("check-in")}>Nhận phòng</Button>{!canCheckIn ? <p className="text-xs text-[var(--muted)]">{detail.checkOutAt <= hotelNow ? "Lịch lưu trú đã qua. Sửa ngày ở hoặc đánh dấu khách không đến." : "Booking thuộc ngày tới. Sửa giờ đến nếu khách nhận phòng sớm."}</p> : null}</> : null}
        {detail.status === "CHECKED_IN" ? <><Button className="w-full" disabled={!canCheckOut || saving} onClick={() => setPendingAction("check-out")}>Trả phòng · kết thúc lượt</Button>{!canCheckOut ? <p className="text-xs text-[#8a5a2f]">Còn {formatCurrency(amount)}. Thu tiền hoặc ghi công nợ trước khi trả phòng.</p> : null}</> : null}
        {!saving ? <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><Link className="font-semibold text-[var(--primary)] hover:underline" href={`/bookings?bookingId=${detail.id}&mode=view`}>Xem booking</Link>{detail.status === "BOOKED" || detail.status === "CHECKED_IN" ? <div className="flex flex-wrap gap-3"><Link className="font-semibold text-[var(--primary)] hover:underline" href={`/bookings?bookingId=${detail.id}#booking-finance`}>Sửa chi phí</Link><Link className="font-semibold text-[var(--primary)] hover:underline" href={`/bookings?bookingId=${detail.id}#booking-payments`}>Thu tiền</Link></div> : detail.status === "CANCELLED" || detail.status === "NO_SHOW" ? <Link className="font-semibold text-[var(--primary)] hover:underline" href={`/bookings?bookingId=${detail.id}#booking-payments`}>Xem / hoàn cọc</Link> : null}</div> : null}
        {!saving && detail.status === "BOOKED" ? <div className="flex gap-4 border-t border-[var(--border)] pt-3 text-xs">{detail.checkInAt < hotelNow ? <button className="text-[var(--muted)] hover:text-[#8c493e]" onClick={() => setPendingAction("no-show")} type="button">Khách không đến</button> : null}<button className="text-[var(--muted)] hover:text-[#8c493e]" onClick={() => setPendingAction("cancel")} type="button">Hủy đặt phòng</button></div> : null}
      </>}
    </div> : null}
  </dialog>;
}

function Info({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-0.5 font-medium text-[var(--foreground)]">{value}</dd></div>;
}

function Money({ label, value }: Readonly<{ label: string; value: number }>) {
  return <div className="flex justify-between gap-3"><dt className="text-[var(--muted)]">{label}</dt><dd className="font-medium tabular-nums">{formatCurrency(value)}</dd></div>;
}
