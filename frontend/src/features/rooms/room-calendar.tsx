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
  AVAILABLE: "bg-emerald-50/80 text-emerald-800 shadow-[inset_3px_0_0_#6ee7b7]",
  BOOKED: "bg-blue-50/80 text-blue-800 shadow-[inset_3px_0_0_#93c5fd] hover:bg-blue-100/80",
  CHECKED_IN: "bg-amber-50/80 text-amber-900 shadow-[inset_3px_0_0_#fcd34d] hover:bg-amber-100/80",
  MAINTENANCE: "bg-rose-50/80 text-rose-800 shadow-[inset_3px_0_0_#fda4af]",
  INACTIVE: "bg-slate-100 text-slate-500 shadow-[inset_3px_0_0_#cbd5e1]",
};

const statusDots = {
  AVAILABLE: "bg-emerald-400",
  BOOKED: "bg-blue-400",
  CHECKED_IN: "bg-amber-400",
  MAINTENANCE: "bg-rose-400",
  INACTIVE: "bg-slate-400",
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
    <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm" aria-label="Kiểu lịch phòng">
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
    void getRoomCalendar(dateFrom, days).then((result) => { if (active) setData(result); }).catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải ma trận phòng."))).finally(() => setLoading(false));
    return () => { active = false; };
  }, [dateFrom, days, reloadKey]);

  function refresh() { setLoading(true); setError(undefined); setReloadKey((value) => value + 1); }

  const roomTypes = useMemo(() => [...new Set(data?.rooms.map((room) => room.roomTypeName) ?? [])].sort(), [data]);
  const floors = useMemo(() => [...new Set((data?.rooms.map((room) => room.floorLabel).filter(Boolean) ?? []) as string[])].sort((a, b) => a.localeCompare(b, "vi", { numeric: true })), [data]);
  const visibleRooms = useMemo(() => (data?.rooms ?? []).filter((room) =>
    (!roomType || room.roomTypeName === roomType) && (!floor || room.floorLabel === floor)), [data, floor, roomType]);

  return <>
    <div className="mb-4 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Từ ngày<Input className="mt-1 w-44" onChange={(e) => { setLoading(true); setError(undefined); setDateFrom(e.target.value); }} type="date" value={dateFrom} /></label>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Khoảng xem<Select className="mt-1 w-36" onChange={(e) => { setLoading(true); setError(undefined); setDays(Number(e.target.value)); }} value={days}><option value={7}>7 ngày</option><option value={14}>14 ngày</option><option value={21}>21 ngày</option><option value={31}>31 ngày</option></Select></label>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Hạng phòng<Select className="mt-1 w-44" onChange={(event) => setRoomType(event.target.value)} value={roomType}><option value="">Tất cả hạng</option>{roomTypes.map((item) => <option key={item}>{item}</option>)}</Select></label>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Tầng<Select className="mt-1 w-36" onChange={(event) => setFloor(event.target.value)} value={floor}><option value="">Tất cả tầng</option>{floors.map((item) => <option key={item} value={item}>Tầng {item}</option>)}</Select></label>
        <Button onClick={() => { setLoading(true); setError(undefined); setDateFrom(localDate()); }} variant="secondary">Hôm nay</Button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600 lg:ml-auto"><Legend color="bg-emerald-200" label="Trống" /><Legend color="bg-blue-200" label="Đã đặt" /><Legend color="bg-amber-200" label="Đang ở" /><Legend color="bg-rose-200" label="Bảo trì" /><Legend color="bg-slate-300" label="Ngừng dùng" /></div>
    </div>
    {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Không thể tải ma trận" /> : loading ? <DataMessage title="Đang kiểm tra lịch phòng…" /> : !visibleRooms.length ? <DataMessage description="Thử thay đổi hạng phòng hoặc tầng." title="Không có phòng phù hợp" /> : <div className="max-h-[68vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="border-separate border-spacing-0 text-left text-xs">
        <thead className="sticky top-0 z-20 bg-slate-50"><tr><th className="sticky left-0 z-30 min-w-44 border-b border-r border-slate-200 bg-slate-50 px-4 py-3">Phòng</th>{data?.dates.map((date) => <th className="min-w-28 border-b border-r border-slate-200 px-2 py-3 text-center font-semibold capitalize text-slate-600" key={date}>{dateLabel(date)}</th>)}</tr></thead>
        <tbody>{visibleRooms.map((room) => <tr key={room.roomId}><th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-3"><b className="block text-sm text-slate-900">{room.roomNumber}</b><span className="font-normal text-slate-500">{room.roomTypeName}{room.floorLabel ? ` · Tầng ${room.floorLabel}` : ""}</span></th>{room.cells.map((cell) => <td className="border-b border-r border-slate-200 p-0" key={cell.date}><CalendarCell cell={cell} /></td>)}</tr>)}</tbody>
      </table>
    </div>}
  </>;
}

function ModeButton({ active, label, onClick }: Readonly<{ active: boolean; label: string; onClick: () => void }>) {
  return <button aria-pressed={active} className={`min-h-9 rounded-md px-4 text-sm font-medium transition ${active ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200" : "text-slate-600 hover:bg-slate-50"}`} onClick={onClick} type="button">{label}</button>;
}

function CalendarCell({ cell }: Readonly<{ cell: RoomCalendarCell }>) {
  if (cell.status === "AVAILABLE") return <div className={`flex min-h-16 items-center gap-2 px-3 py-2 font-medium ${statusStyles.AVAILABLE}`}><StatusDot status="AVAILABLE" />Trống</div>;
  if (cell.status === "MAINTENANCE") return <div className={`min-h-16 px-3 py-2 ${statusStyles.MAINTENANCE}`} title={cell.maintenanceReason}><b className="flex items-center gap-2"><StatusDot status="MAINTENANCE" />Bảo trì</b><span className="mt-0.5 block truncate pl-4 text-[11px] opacity-80">{cell.maintenanceReason}</span></div>;
  if (cell.bookingId) return <Link className={`block min-h-16 px-3 py-2 ${statusStyles[cell.status]}`} href={`/bookings?bookingId=${cell.bookingId}`} title={`${cell.bookingCode} · ${cell.customerName}`}><b className="flex items-center gap-2"><StatusDot status={cell.status} />{cell.status === "CHECKED_IN" ? "Đang ở" : "Đã đặt"}</b><span className="mt-0.5 block truncate pl-4 text-[11px]">{cell.customerName}</span></Link>;
  return <div className={`flex min-h-16 items-center gap-2 px-3 py-2 font-medium ${statusStyles.INACTIVE}`}><StatusDot status="INACTIVE" />Ngừng dùng</div>;
}

function StatusDot({ status }: Readonly<{ status: keyof typeof statusDots }>) { return <span className={`size-2 shrink-0 rounded-full ${statusDots[status]}`} />; }

function Legend({ color, label }: Readonly<{ color: string; label: string }>) { return <span className="inline-flex items-center gap-1.5"><span className={`size-3 rounded ${color}`} />{label}</span>; }
