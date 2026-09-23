"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { DataMessage, Panel } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { getBookingOperations } from "@/features/bookings/bookings-api";
import type { BookingListItem, BookingOperationsSnapshot } from "@/features/bookings/types";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { BookingOperationDrawer } from "./booking-operation-drawer";

type QueueKey = "attention" | "arrivals" | "departures" | "inHouse" | "upcoming";

const queues: Array<{ key: QueueKey; label: string; empty: string }> = [
  { key: "attention", label: "Cần xử lý", empty: "Không có lượt nhận hoặc trả phòng quá giờ." },
  { key: "arrivals", label: "Đến hôm nay", empty: "Hôm nay chưa có khách chờ nhận phòng." },
  { key: "departures", label: "Đi hôm nay", empty: "Hôm nay chưa có khách chờ trả phòng." },
  { key: "inHouse", label: "Đang ở", empty: "Hiện chưa có khách đang lưu trú." },
  { key: "upcoming", label: "Sắp đến", empty: "Bảy ngày tới chưa có lượt đặt phòng nào." },
];

function day(value: string) { return value.slice(0, 10); }
function dueAt(booking: BookingListItem) { return booking.status === "CHECKED_IN" ? booking.checkOutAt : booking.checkInAt; }
function isOverdue(booking: BookingListItem, now: string) { return dueAt(booking) < now; }
function amountToCollect(booking: BookingListItem) {
  return Math.max(0, booking.previousDebt + booking.grossRevenue - booking.paidAmount - booking.debtAmount);
}

function belongsToQueue(booking: BookingListItem, key: QueueKey, snapshot: BookingOperationsSnapshot) {
  const booked = booking.status === "BOOKED";
  const inHouse = booking.status === "CHECKED_IN";
  switch (key) {
    case "attention": return (booked || inHouse) && isOverdue(booking, snapshot.hotelNow);
    case "arrivals": return booked && day(booking.checkInAt) === snapshot.hotelDate;
    case "departures": return inHouse && day(booking.checkOutAt) === snapshot.hotelDate;
    case "inHouse": return inHouse;
    case "upcoming": return booked && day(booking.checkInAt) > snapshot.hotelDate;
  }
}

export function OperationsDashboard() {
  const [snapshot, setSnapshot] = useState<BookingOperationsSnapshot>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [queue, setQueue] = useState<QueueKey>("attention");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BookingListItem>();

  useEffect(() => {
    let active = true;
    void getBookingOperations()
      .then((result) => { if (active) { setSnapshot(result); setError(undefined); } })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, "Không thể tải ca trực.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const counts = useMemo(() => Object.fromEntries(queues.map((item) => [
    item.key, snapshot?.items.filter((booking) => belongsToQueue(booking, item.key, snapshot)).length ?? 0,
  ])) as Record<QueueKey, number>, [snapshot]);

  const visible = useMemo(() => {
    if (!snapshot) return [];
    const term = query.trim().toLocaleLowerCase("vi");
    return snapshot.items.filter((booking) => belongsToQueue(booking, queue, snapshot))
      .filter((booking) => !term || [booking.roomNumber, booking.customerName, booking.customerPhone, booking.bookingCode, booking.groupCode]
        .some((value) => value?.toLocaleLowerCase("vi").includes(term)))
      .sort((a, b) => dueAt(a).localeCompare(dueAt(b)) || a.roomNumber.localeCompare(b.roomNumber, "vi", { numeric: true }));
  }, [query, queue, snapshot]);

  function refresh() {
    setLoading(true);
    setError(undefined);
    setReloadKey((value) => value + 1);
  }

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % queues.length
      : event.key === "ArrowLeft" ? (index - 1 + queues.length) % queues.length
        : event.key === "Home" ? 0 : event.key === "End" ? queues.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setQueue(queues[next].key);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']")[next]?.focus();
  }

  const activeQueue = queues.find((item) => item.key === queue)!;
  const hotelDay = snapshot?.hotelDate
    ? new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${snapshot.hotelDate}T12:00:00`))
    : "Hôm nay";

  return <>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:px-5">
        <div><p className="text-sm font-semibold text-[var(--foreground)]">{hotelDay}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{snapshot ? `Dữ liệu lúc ${snapshot.hotelNow.slice(11, 16)} · giờ khách sạn` : "Đang lấy dữ liệu ca trực"}</p></div>
        <div className="flex items-center gap-2"><Button disabled={loading} onClick={refresh} variant="secondary">{loading && snapshot ? "Đang cập nhật…" : "Làm mới"}</Button><Link className="inline-flex min-h-10 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-strong)]" href="/bookings">Tạo đặt phòng</Link></div>
      </div>

      <Panel className="!p-0">
        <div aria-label="Hàng đợi ca trực" className="flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--sidebar)] px-3 pt-2" role="tablist">
          {queues.map((item, index) => <button aria-controls="operations-queue" aria-selected={queue === item.key} className={`min-h-11 shrink-0 rounded-t-lg border-b-[3px] px-4 text-sm transition-colors ${queue === item.key ? "border-[var(--primary)] bg-white font-semibold text-[var(--primary-strong)] shadow-[0_-1px_0_var(--border),1px_0_0_var(--border),-1px_0_0_var(--border)]" : "border-transparent font-medium text-[var(--muted)] hover:bg-white/70 hover:text-[var(--foreground)]"}`} id={`queue-${item.key}`} key={item.key} onClick={() => setQueue(item.key)} onKeyDown={(event) => moveTab(event, index)} role="tab" tabIndex={queue === item.key ? 0 : -1} type="button">{item.label}<span className={`ml-2 rounded-md px-1.5 py-0.5 text-xs tabular-nums ${queue === item.key ? "bg-[var(--nav-active)] text-[var(--primary-strong)]" : "bg-[var(--surface-muted)]"}`}>{counts[item.key]}</span></button>)}
        </div>
        <div aria-labelledby={`queue-${queue}`} className="p-4 sm:p-5" id="operations-queue" role="tabpanel">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div><h2 className="text-base font-semibold text-[var(--foreground)]">{activeQueue.label}</h2><p className="mt-0.5 text-xs text-[var(--muted)]">{queue === "upcoming" ? "Lượt đặt trong 7 ngày tới" : queue === "attention" ? "Booking đã qua giờ nhận hoặc trả phòng dự kiến" : "Theo trạng thái booking, không phải trạng thái dọn phòng"}</p></div>
            <Input aria-label="Tìm trong ca trực" className="sm:max-w-80" onChange={(event) => setQuery(event.target.value)} placeholder="Tên khách, SĐT, phòng hoặc mã" value={query} />
          </div>
          {error ? <p className="mb-4 rounded-lg border border-[#dfc0b9] bg-[#f9efec] px-4 py-3 text-sm text-[#8c493e]" role="alert">{error}{snapshot ? " Dữ liệu bên dưới có thể đã cũ." : ""}</p> : null}
          {!snapshot && loading ? <QueueSkeleton /> : !snapshot ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} title="Chưa tải được ca trực" /> : visible.length === 0 ? <DataMessage description={query ? "Thử từ khóa khác hoặc xóa nội dung tìm kiếm." : activeQueue.empty} title={query ? "Không tìm thấy booking phù hợp" : "Chưa có việc trong mục này"} /> : <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <div className="hidden grid-cols-[5.5rem_6.5rem_minmax(11rem,1fr)_8rem_9rem_5.5rem] gap-3 bg-[var(--sidebar)] px-4 py-3 text-xs font-semibold text-[var(--muted)] xl:grid"><span>Giờ hẹn</span><span>Phòng</span><span>Khách · Mã</span><span>Trạng thái</span><span>Thanh toán</span><span className="text-right">Thao tác</span></div>
            <div className="divide-y divide-[var(--border)]">{visible.map((booking) => <BookingRow booking={booking} hotelDate={snapshot.hotelDate} hotelNow={snapshot.hotelNow} key={booking.id} onOpen={() => setSelected(booking)} />)}</div>
          </div>}
        </div>
      </Panel>
    </div>
    {selected && snapshot ? <BookingOperationDrawer booking={selected} hotelDate={snapshot.hotelDate} hotelNow={snapshot.hotelNow} onChanged={refresh} onClose={() => setSelected(undefined)} /> : null}
  </>;
}

function BookingRow({ booking, hotelDate, hotelNow, onOpen }: Readonly<{ booking: BookingListItem; hotelDate: string; hotelNow: string; onOpen: () => void }>) {
  const overdue = isOverdue(booking, hotelNow);
  const due = dueAt(booking);
  const amount = amountToCollect(booking);
  const needsAction = (booking.status === "BOOKED" && day(booking.checkInAt) <= hotelDate) || (booking.status === "CHECKED_IN" && day(booking.checkOutAt) <= hotelDate);
  return <article className={`grid gap-3 bg-white px-4 py-4 transition-colors hover:bg-[var(--sidebar)] xl:grid-cols-[5.5rem_6.5rem_minmax(11rem,1fr)_8rem_9rem_5.5rem] xl:items-center xl:gap-3 ${overdue ? "border-l-[3px] border-l-[#b85c4a]" : ""}`}>
    <div><p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">{due.slice(11, 16)}</p><p className="text-xs text-[var(--muted)]">{day(due) === hotelDate ? "Hôm nay" : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(due))}</p></div>
    <div><p className="text-sm font-semibold text-[var(--foreground)]">Phòng {booking.roomNumber}</p><p className="text-xs text-[var(--muted)]">{booking.roomTypeName}</p></div>
    <div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--foreground)]">{booking.customerName}</p><p className="truncate text-xs text-[var(--muted)]">{booking.bookingCode}{booking.customerPhone ? ` · ${booking.customerPhone}` : ""}</p></div>
    <div className="flex flex-wrap items-center gap-1.5"><StatusBadge status={booking.status} />{overdue ? <span className="text-xs font-semibold text-[#9b5145]">{booking.status === "BOOKED" ? "Quá giờ nhận" : "Quá giờ trả"}</span> : null}</div>
    <div className="text-sm">{amount > 0 ? <p className="font-semibold text-[#8a5a2f]">Còn thu {formatCurrency(amount)}</p> : <p className="font-medium text-[var(--foreground)]">{booking.debtAmount > 0 ? "Đã ghi công nợ" : "Đã thu đủ"}</p>}{booking.debtAmount > 0 ? <p className="text-xs text-[var(--muted)]">Công nợ {formatCurrency(booking.debtAmount)}</p> : null}</div>
    <div className="xl:text-right"><Button aria-label={`Kiểm tra ${booking.bookingCode} của ${booking.customerName}`} className="w-full whitespace-nowrap xl:w-auto" onClick={onOpen} size="sm" variant={needsAction ? "primary" : "secondary"}>Kiểm tra</Button></div>
  </article>;
}

function QueueSkeleton() {
  return <div aria-label="Đang tải ca trực" className="space-y-2" role="status">{Array.from({ length: 4 }, (_, index) => <div className="h-16 animate-pulse rounded-lg bg-[var(--surface-muted)]" key={index} />)}</div>;
}
