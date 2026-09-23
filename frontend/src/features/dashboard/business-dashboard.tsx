"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataMessage, Panel } from "@/components/ui/page";
import { useLiveRevision } from "@/features/realtime/live-updates-provider";
import { apiRequest, getApiErrorMessage } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";

type Month = {
  month: string;
  bookingCount: number;
  actualRoomNights: number;
  availableRoomNights: number;
  occupancyRate: number | null;
  roomRevenue: number;
  serviceRevenue: number;
  paidAmount: number;
  bookingAverageDailyRate: number | null;
};
type Channel = { category: string; bookingCount: number; grossRevenue: number };
type RoomType = { name: string; roomRevenue: number; actualRoomNights: number; availableRoomNights: number; occupancyRate: number | null };
type Snapshot = { hotelNow: string; selectedMonth: string; months: Month[]; channels: Channel[]; roomTypes: RoomType[] };

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("vi-VN", { month: "short", year: "numeric" }).format(new Date(`${month}-01T12:00:00`));
}
function percent(value: number | null) { return value === null ? "—" : `${Math.round(value * 100)}%`; }
function barWidth(value: number, maximum: number) { return `${value > 0 && maximum > 0 ? Math.max(2, value / maximum * 100) : 0}%`; }
function categoryName(value: string) {
  return ({ OFFLINE: "Trực tiếp", ONLINE: "Trực tuyến", TRAVEL_AGENCY: "Đại lý" } as Record<string, string>)[value] ?? value;
}

export function BusinessDashboard() {
  const revision = useLiveRevision();
  const [month, setMonth] = useState<string>();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    const query = month ? `?month=${encodeURIComponent(month)}` : "";
    void apiRequest<Snapshot>(`/api/dashboard${query}`)
      .then((result) => { if (active) { setSnapshot(result); setError(undefined); } })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, "Không thể tải báo cáo quản trị.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, revision]);

  const selected = snapshot?.months.find((item) => item.month === snapshot.selectedMonth);
  const current = !month || snapshot?.selectedMonth === month;
  const chartMonths = snapshot?.months.filter((item) => item.month <= snapshot.selectedMonth).slice(-12) ?? [];
  const maximum = Math.max(...chartMonths.map((item) => item.roomRevenue + item.serviceRevenue), 0);
  const channelMax = Math.max(...(snapshot?.channels.map((item) => item.grossRevenue) ?? []), 0);
  const roomMax = Math.max(...(snapshot?.roomTypes.map((item) => item.roomRevenue) ?? []), 0);
  const occupancyMax = Math.max(...chartMonths.map((item) => item.occupancyRate ?? 0), 0);

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Tổng quan kinh doanh</h1><p className="mt-1 text-sm text-[var(--muted)]">Số liệu trực tiếp từ Azure SQL, tự cập nhật khi nghiệp vụ thay đổi.</p></div>
      <div className="flex items-center gap-3"><label className="text-sm font-medium" htmlFor="dashboard-month">Tháng</label><select className="min-h-10 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm" disabled={!snapshot?.months.length} id="dashboard-month" onChange={(event) => { setLoading(true); setMonth(event.target.value); }} value={month ?? snapshot?.selectedMonth ?? ""}>{snapshot?.months.map((item) => <option key={item.month} value={item.month}>{monthLabel(item.month)}</option>)}</select></div>
    </div>

    {error ? <p className="rounded-lg border border-[#dfc0b9] bg-[#f9efec] px-4 py-3 text-sm text-[#8c493e]" role="alert">{error}{snapshot ? " Số liệu bên dưới có thể đã cũ." : ""}</p> : null}
    {!snapshot && loading ? <div aria-label="Đang tải báo cáo" className="h-64 animate-pulse rounded-xl bg-[var(--surface-muted)]" role="status" /> : !snapshot ? <DataMessage title="Chưa tải được báo cáo" /> : <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]"><p>{loading || !current ? "Đang cập nhật…" : `Dữ liệu lúc ${snapshot.hotelNow.slice(11, 16)} · giờ khách sạn`}</p><Link className="font-semibold text-[var(--primary)] hover:underline" href="/operations">Xem theo dõi phòng →</Link></div>
      {current && selected ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="Tổng booking" value={selected.bookingCount.toLocaleString("vi-VN")} />
        <Metric label="Doanh thu phòng" value={formatCurrency(selected.roomRevenue)} />
        <Metric label="Đã thu trong kỳ" value={formatCurrency(selected.paidAmount)} />
        <Metric label="Công suất phòng" value={percent(selected.occupancyRate)} detail={`${selected.actualRoomNights.toLocaleString("vi-VN")} / ${selected.availableRoomNights.toLocaleString("vi-VN")} đêm có thể bán trong tháng`} />
        <Metric label="Giá phòng bình quân / đêm" value={selected.bookingAverageDailyRate === null ? "—" : formatCurrency(selected.bookingAverageDailyRate)} />
        <Metric label="Đêm phòng đã ở" value={selected.actualRoomNights.toLocaleString("vi-VN")} />
      </div> : <DataMessage title={loading ? "Đang cập nhật tháng đã chọn" : "Tháng này chưa có dữ liệu"} />}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel><h2 className="text-base font-semibold">Tiền phòng & dịch vụ theo tháng</h2><p className="mt-1 text-xs text-[var(--muted)]">Giá trị booking theo tháng nhận phòng</p>{maximum === 0 ? <p className="mt-5 text-sm text-[var(--muted)]">Chưa có doanh thu trong 12 tháng tính đến tháng đã chọn.</p> : <><div className="mt-5 space-y-3">{chartMonths.map((item) => <div className="grid grid-cols-[4.5rem_1fr_6rem] items-center gap-3 text-xs sm:grid-cols-[6rem_1fr_7rem]" key={item.month}><span>{monthLabel(item.month)}</span><div aria-label={`${monthLabel(item.month)}: phòng ${formatCurrency(item.roomRevenue)}, dịch vụ ${formatCurrency(item.serviceRevenue)}`} className="flex h-6 overflow-hidden rounded bg-[var(--surface-muted)]" role="img"><span className="bg-[var(--primary)]" style={{ width: barWidth(item.roomRevenue, maximum) }} /><span className="bg-[#86aa9d]" style={{ width: barWidth(item.serviceRevenue, maximum) }} /></div><strong className="text-right tabular-nums">{formatCurrency(item.roomRevenue + item.serviceRevenue)}</strong></div>)}</div><p className="mt-4 text-xs text-[var(--muted)]"><span className="mr-3 text-[var(--primary)]">● Phòng</span><span className="text-[#668f81]">● Dịch vụ</span></p></>}</Panel>
        <Panel><h2 className="text-base font-semibold">Công suất theo tháng</h2><p className="mt-1 text-xs text-[var(--muted)]">Đêm đã ở / đêm phòng có thể bán</p>{occupancyMax === 0 ? <p className="mt-5 text-sm text-[var(--muted)]">Chưa ghi nhận đêm phòng đã ở trong 12 tháng tính đến tháng đã chọn.</p> : <div className="mt-5 space-y-3">{chartMonths.map((item) => <div className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-3 text-xs sm:grid-cols-[6rem_1fr_3rem]" key={item.month}><span>{monthLabel(item.month)}</span><div aria-label={`${monthLabel(item.month)}: ${percent(item.occupancyRate)}`} className="h-6 overflow-hidden rounded bg-[var(--surface-muted)]" role="img"><div className="h-full bg-[#86aa9d]" style={{ width: barWidth(item.occupancyRate ?? 0, 1) }} /></div><strong className="text-right tabular-nums">{percent(item.occupancyRate)}</strong></div>)}</div>}</Panel>
        <Panel><h2 className="text-base font-semibold">Tổng giá trị booking theo kênh</h2><p className="mt-1 text-xs text-[var(--muted)]">{monthLabel(snapshot.selectedMonth)} · theo tháng nhận phòng</p><Breakdown rows={snapshot.channels.map((item) => ({ label: categoryName(item.category), value: item.grossRevenue, detail: `${item.bookingCount} booking` }))} maximum={channelMax} /></Panel>
        <Panel><h2 className="text-base font-semibold">Doanh thu phòng theo hạng</h2><p className="mt-1 text-xs text-[var(--muted)]">{monthLabel(snapshot.selectedMonth)} · công suất thực tế</p><Breakdown rows={snapshot.roomTypes.filter((item) => item.roomRevenue > 0).map((item) => ({ label: item.name, value: item.roomRevenue, detail: `${percent(item.occupancyRate)} công suất` }))} maximum={roomMax} /></Panel>
      </div>
    </>}
  </div>;
}

function Metric({ label, value, detail }: Readonly<{ label: string; value: string; detail?: string }>) {
  return <Panel className="!p-4"><p className="text-sm text-[var(--muted)]">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-[var(--primary-strong)]">{value}</p>{detail ? <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p> : null}</Panel>;
}

function Breakdown({ rows, maximum }: Readonly<{ rows: { label: string; value: number; detail: string }[]; maximum: number }>) {
  if (!rows.length) return <p className="mt-5 text-sm text-[var(--muted)]">Chưa có dữ liệu trong tháng.</p>;
  return <div className="mt-5 space-y-4">{rows.map((row) => <div key={row.label}><div className="flex justify-between gap-3 text-sm"><span className="font-medium">{row.label}<small className="ml-2 text-[var(--muted)]">{row.detail}</small></span><strong className="tabular-nums">{formatCurrency(row.value)}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[var(--primary)]" style={{ width: barWidth(row.value, maximum) }} /></div></div>)}</div>;
}
