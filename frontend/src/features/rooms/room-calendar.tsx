"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataMessage } from "@/components/ui/page";
import { getApiErrorMessage } from "@/lib/api-client";
import { getRoomCalendar } from "./rooms-api";
import { RoomHourlyCalendar } from "./room-hourly-calendar";
import type { RoomCalendarCell, RoomCalendarResponse } from "./types";

const statusStyles = {
  AVAILABLE: "bg-[#edf5f2] text-[#24544d] shadow-[inset_3px_0_0_#2f5d62]",
  BOOKED: "bg-[#faf4e9] text-[#755b2e] shadow-[inset_3px_0_0_#b08d57] hover:bg-[#f3ead8]",
  CHECKED_IN: "bg-[#edf4ed] text-[#365c42] shadow-[inset_3px_0_0_#5f8d7a] hover:bg-[#e2eee2]",
  MAINTENANCE: "bg-[#f9efec] text-[#8c493e] shadow-[inset_3px_0_0_#b85c4a]",
  INACTIVE: "bg-[var(--surface-muted)] text-[var(--muted)] shadow-[inset_3px_0_0_#a5aaa5]",
};

const statusDots = {
  AVAILABLE: "bg-[#2f5d62]",
  BOOKED: "bg-[#b08d57]",
  CHECKED_IN: "bg-[#5f8d7a]",
  MAINTENANCE: "bg-[#b85c4a]",
  INACTIVE: "bg-[#a5aaa5]",
};

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${value}T00:00:00`));
}

export function RoomCalendar() {
  const [mode, setMode] = useState<"daily" | "hourly">("daily");
  return <>
    <div className="mb-4 inline-flex rounded-lg border border-[var(--border)] bg-white p-1" aria-label="Kiểu lịch phòng">
      <ModeButton active={mode === "daily"} label="Theo ngày" onClick={() => setMode("daily")} />
      <ModeButton active={mode === "hourly"} label="Theo giờ" onClick={() => setMode("hourly")} />
    </div>
    {mode === "daily" ? <DailyRoomCalendar /> : <RoomHourlyCalendar />}
  </>;
}

function DailyRoomCalendar() {
  const [dateFrom, setDateFrom] = useState(localDate());
  const [days, setDays] = useState(14);
  const [roomType, setRoomType] = useState("");
  const [floor, setFloor] = useState("");
  const [data, setData] = useState<RoomCalendarResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void getRoomCalendar(dateFrom, days).then((result) => { if (active) setData(result); }).catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải lịch phòng."))).finally(() => setLoading(false));
    return () => { active = false; };
  }, [dateFrom, days, reloadKey]);

  function refresh() { setLoading(true); setError(undefined); setReloadKey((value) => value + 1); }

  const roomTypes = useMemo(() => [...new Set(data?.rooms.map((room) => room.roomTypeName) ?? [])].sort(), [data]);
  const floors = useMemo(() => [...new Set((data?.rooms.map((room) => room.floorLabel).filter(Boolean) ?? []) as string[])].sort((a, b) => a.localeCompare(b, "vi", { numeric: true })), [data]);
  const visibleRooms = useMemo(() => (data?.rooms ?? []).filter((room) =>
    (!roomType || room.roomTypeName === roomType) && (!floor || room.floorLabel === floor)), [data, floor, roomType]);

  return <>
    <div className="mb-4 flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-white p-4 lg:flex-row lg:items-center">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-[var(--muted)]">Từ ngày<Input className="mt-1 w-44" onChange={(e) => { setLoading(true); setError(undefined); setDateFrom(e.target.value); }} type="date" value={dateFrom} /></label>
        <label className="text-xs font-medium text-[var(--muted)]">Khoảng xem<Select className="mt-1 w-36" onChange={(e) => { setLoading(true); setError(undefined); setDays(Number(e.target.value)); }} value={days}><option value={7}>7 ngày</option><option value={14}>14 ngày</option><option value={21}>21 ngày</option><option value={31}>31 ngày</option></Select></label>
        <label className="text-xs font-medium text-[var(--muted)]">Hạng phòng<Select className="mt-1 w-44" onChange={(event) => setRoomType(event.target.value)} value={roomType}><option value="">Tất cả hạng</option>{roomTypes.map((item) => <option key={item}>{item}</option>)}</Select></label>
        <label className="text-xs font-medium text-[var(--muted)]">Tầng<Select className="mt-1 w-36" onChange={(event) => setFloor(event.target.value)} value={floor}><option value="">Tất cả tầng</option>{floors.map((item) => <option key={item} value={item}>Tầng {item}</option>)}</Select></label>
        <Button onClick={() => { setLoading(true); setError(undefined); setDateFrom(localDate()); }} variant="secondary">Hôm nay</Button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--muted)] lg:ml-auto"><Legend color="bg-[#2f5d62]" label="Trống" /><Legend color="bg-[#b08d57]" label="Đã đặt" /><Legend color="bg-[#5f8d7a]" label="Đang ở" /><Legend color="bg-[#b85c4a]" label="Bảo trì" /><Legend color="bg-[#a5aaa5]" label="Ngừng dùng" /></div>
    </div>
    {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Chưa tải được lịch phòng" /> : loading ? <DataMessage title="Đang lấy lịch phòng…" /> : !visibleRooms.length ? <DataMessage description="Bạn thử hạng phòng hoặc tầng khác nhé." title="Không có phòng phù hợp" /> : <div className="max-h-[68vh] overflow-auto rounded-xl border border-[var(--border)] bg-white">
      <table className="border-separate border-spacing-0 text-left text-xs">
        <thead className="sticky top-0 z-20 bg-slate-50"><tr><th className="sticky left-0 z-30 min-w-44 border-b border-r border-slate-200 bg-slate-50 px-4 py-3">Phòng</th>{data?.dates.map((date) => <th className="min-w-28 border-b border-r border-slate-200 px-2 py-3 text-center font-semibold capitalize text-slate-600" key={date}>{dateLabel(date)}</th>)}</tr></thead>
        <tbody>{visibleRooms.map((room) => <tr key={room.roomId}><th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-3"><b className="block text-sm text-slate-900">{room.roomNumber}</b><span className="font-normal text-slate-500">{room.roomTypeName}{room.floorLabel ? ` · Tầng ${room.floorLabel}` : ""}</span></th>{room.cells.map((cell) => <td className="border-b border-r border-slate-200 p-0" key={cell.date}><CalendarCell cell={cell} /></td>)}</tr>)}</tbody>
      </table>
    </div>}
  </>;
}

function ModeButton({ active, label, onClick }: Readonly<{ active: boolean; label: string; onClick: () => void }>) {
  return <button aria-pressed={active} className={`min-h-9 rounded-md px-4 text-sm font-medium transition-colors ${active ? "bg-[var(--nav-active)] text-[var(--primary-strong)] ring-1 ring-[#bdd1cb]" : "text-[var(--muted)] hover:bg-[var(--surface-muted)]"}`} onClick={onClick} type="button">{label}</button>;
}

function CalendarCell({ cell }: Readonly<{ cell: RoomCalendarCell }>) {
  if (cell.status === "AVAILABLE") return <div className={`flex min-h-16 items-center gap-2 px-3 py-2 font-medium ${statusStyles.AVAILABLE}`}><StatusDot status="AVAILABLE" />Trống</div>;
  if (cell.status === "MAINTENANCE") return <div className={`min-h-16 px-3 py-2 ${statusStyles.MAINTENANCE}`} title={cell.maintenanceReason}><b className="flex items-center gap-2"><StatusDot status="MAINTENANCE" />Bảo trì</b><span className="mt-0.5 block truncate pl-4 text-[11px] opacity-80">{cell.maintenanceReason}</span></div>;
  if (cell.bookingId) return <Link className={`block min-h-16 px-3 py-2 ${statusStyles[cell.status]}`} href={`/bookings?bookingId=${cell.bookingId}`} title={`${cell.bookingCode} · ${cell.customerName}`}><b className="flex items-center gap-2"><StatusDot status={cell.status} />{cell.status === "CHECKED_IN" ? "Đang ở" : "Đã đặt"}</b><span className="mt-0.5 block truncate pl-4 text-[11px]">{cell.customerName}</span></Link>;
  return <div className={`flex min-h-16 items-center gap-2 px-3 py-2 font-medium ${statusStyles.INACTIVE}`}><StatusDot status="INACTIVE" />Ngừng dùng</div>;
}

function StatusDot({ status }: Readonly<{ status: keyof typeof statusDots }>) { return <span className={`size-2 shrink-0 rounded-full ${statusDots[status]}`} />; }

function Legend({ color, label }: Readonly<{ color: string; label: string }>) { return <span className="inline-flex items-center gap-1.5"><span className={`size-3 rounded ${color}`} />{label}</span>; }
