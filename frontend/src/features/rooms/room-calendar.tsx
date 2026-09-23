"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataMessage } from "@/components/ui/page";
import { getApiErrorMessage } from "@/lib/api-client";
import { getRoomCalendar } from "./rooms-api";
import { RoomHourlyCalendar } from "./room-hourly-calendar";
import { bookingAccent, calendarStatus } from "./room-calendar-colors";
import type { RoomCalendarCell, RoomCalendarResponse } from "./types";

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${value}T00:00:00`));
}

export function RoomCalendar() {
  const [mode, setMode] = useState<"daily" | "hourly">("daily");
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="mb-3 inline-flex w-fit shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-1" aria-label="Kiểu lịch phòng">
      <ModeButton active={mode === "daily"} label="Theo ngày" onClick={() => setMode("daily")} />
      <ModeButton active={mode === "hourly"} label="Theo giờ" onClick={() => setMode("hourly")} />
    </div>
    {mode === "daily" ? <DailyRoomCalendar /> : <RoomHourlyCalendar />}
  </div>;
}

function DailyRoomCalendar() {
  const [dateFrom, setDateFrom] = useState(localDate());
  const [days, setDays] = useState(14);
  const [roomType, setRoomType] = useState("");
  const [floor, setFloor] = useState("");
  const [result, setResult] = useState<{ key: string; data?: RoomCalendarResponse; error?: string }>();
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${dateFrom}|${days}|${reloadKey}`;
  const current = result?.key === requestKey ? result : undefined;
  const data = current?.data;
  const error = current?.error;
  const loading = !current;

  useEffect(() => {
    let active = true;
    void getRoomCalendar(dateFrom, days)
      .then((response) => { if (active) setResult({ key: requestKey, data: response }); })
      .catch((reason) => { if (active) setResult({ key: requestKey, error: getApiErrorMessage(reason, "Không thể tải lịch phòng.") }); });
    return () => { active = false; };
  }, [dateFrom, days, requestKey]);

  function refresh() { setReloadKey((value) => value + 1); }

  const roomTypes = useMemo(() => [...new Set(data?.rooms.map((room) => room.roomTypeName) ?? [])].sort(), [data]);
  const floors = useMemo(() => [...new Set((data?.rooms.map((room) => room.floorLabel).filter(Boolean) ?? []) as string[])].sort((a, b) => a.localeCompare(b, "vi", { numeric: true })), [data]);
  const visibleRooms = useMemo(() => (data?.rooms ?? []).filter((room) =>
    (!roomType || room.roomTypeName === roomType) && (!floor || room.floorLabel === floor)), [data, floor, roomType]);

  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="mb-3 flex shrink-0 flex-col gap-3 rounded-xl border border-[var(--border)] bg-white p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-[var(--muted)]">Từ ngày<Input className="mt-1 w-44" onChange={(e) => setDateFrom(e.target.value)} type="date" value={dateFrom} /></label>
        <label className="text-xs font-medium text-[var(--muted)]">Khoảng xem<Select className="mt-1 w-36" onChange={(e) => setDays(Number(e.target.value))} value={days}><option value={7}>7 ngày</option><option value={14}>14 ngày</option><option value={21}>21 ngày</option><option value={31}>31 ngày</option></Select></label>
        <label className="text-xs font-medium text-[var(--muted)]">Hạng phòng<Select className="mt-1 w-44" onChange={(event) => setRoomType(event.target.value)} value={roomType}><option value="">Tất cả hạng</option>{roomTypes.map((item) => <option key={item}>{item}</option>)}</Select></label>
        <label className="text-xs font-medium text-[var(--muted)]">Tầng<Select className="mt-1 w-36" onChange={(event) => setFloor(event.target.value)} value={floor}><option value="">Tất cả tầng</option>{floors.map((item) => <option key={item} value={item}>Tầng {item}</option>)}</Select></label>
        <Button onClick={() => { const today = localDate(); if (dateFrom === today) refresh(); else setDateFrom(today); }} variant="secondary">Hôm nay</Button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]"><Legend color={calendarStatus.AVAILABLE.dot} label="Trống" /><Legend color={calendarStatus.BOOKED.dot} label="Đã đặt" /><Legend color={calendarStatus.CHECKED_IN.dot} label="Đang ở" /><Legend color={calendarStatus.CHECKED_OUT.dot} label="Đã trả (giữ đến giờ đi)" /><Legend color={calendarStatus.MAINTENANCE.dot} label="Bảo trì" /><Legend color={calendarStatus.INACTIVE.dot} label="Ngừng dùng" /><span>Vạch màu: cùng lượt đặt</span></div>
    </div>
    <p className="mb-2 shrink-0 text-xs text-[var(--muted)]">Một ô có thể chứa nhiều lượt trong ngày; xem lịch theo giờ để biết chính xác lúc phòng trống.</p>
    {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Chưa tải được lịch phòng" /> : loading ? <DataMessage title="Đang lấy lịch phòng…" /> : !visibleRooms.length ? <DataMessage description="Bạn thử hạng phòng hoặc tầng khác nhé." title="Không có phòng phù hợp" /> : <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border)] bg-white">
      <table className="border-separate border-spacing-0 text-left text-xs">
        <thead className="sticky top-0 z-20 bg-slate-50"><tr><th className="sticky left-0 z-30 min-w-44 border-b border-r border-slate-200 bg-slate-50 px-4 py-3">Phòng</th>{data?.dates.map((date) => <th className="min-w-28 border-b border-r border-slate-200 px-2 py-3 text-center font-semibold capitalize text-slate-600" key={date}>{dateLabel(date)}</th>)}</tr></thead>
        <tbody>{visibleRooms.map((room) => <tr key={room.roomId}><th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-3"><b className="block text-sm text-slate-900">{room.roomNumber}</b><span className="font-normal text-slate-500">{room.roomTypeName}{room.floorLabel ? ` · Tầng ${room.floorLabel}` : ""}</span></th>{room.cells.map((cell) => <td className="border-b border-r border-slate-200 p-0" key={cell.date}><CalendarCell cell={cell} /></td>)}</tr>)}</tbody>
      </table>
    </div>}
  </div>;
}

function ModeButton({ active, label, onClick }: Readonly<{ active: boolean; label: string; onClick: () => void }>) {
  return <button aria-pressed={active} className={`min-h-9 rounded-md px-4 text-sm transition-colors ${active ? "bg-white font-semibold text-[var(--primary-strong)] shadow-sm ring-1 ring-[var(--border)]" : "font-medium text-[var(--muted)] hover:bg-white/70 hover:text-[var(--foreground)]"}`} onClick={onClick} type="button">{label}</button>;
}

function CalendarCell({ cell }: Readonly<{ cell: RoomCalendarCell }>) {
  if (cell.status === "AVAILABLE") return <div className={`flex min-h-[4.5rem] items-center gap-2 px-3 py-2 font-medium ${calendarStatus.AVAILABLE.cell}`}><StatusDot status="AVAILABLE" />Trống</div>;
  if (cell.status === "MAINTENANCE") return <div className={`min-h-[4.5rem] px-3 py-2 ${calendarStatus.MAINTENANCE.cell}`} title={cell.maintenanceReason}><b className="flex items-center gap-2"><StatusDot status="MAINTENANCE" />Bảo trì</b><span className="mt-0.5 block truncate pl-4 text-[11px] opacity-80">{cell.maintenanceReason}</span></div>;
  if (cell.bookingId) return <Link className={`block min-h-[4.5rem] border-l-4 px-2 py-1.5 ${calendarStatus[cell.status].cell}`} href={`/bookings?bookingId=${cell.bookingId}`} style={{ borderLeftColor: bookingAccent(cell.bookingId) }} title={`${cell.bookingCode} · ${cell.customerName}`}><b className="flex items-center gap-2"><StatusDot status={cell.status} />{cell.status === "CHECKED_IN" ? "Đang ở" : cell.status === "CHECKED_OUT" ? "Đã trả" : "Đã đặt"}</b><span className="mt-0.5 block truncate pl-4 text-[11px]">{cell.customerName}</span><span className="block truncate pl-4 text-[10px] opacity-75">{cell.bookingCode}</span></Link>;
  return <div className={`flex min-h-[4.5rem] items-center gap-2 px-3 py-2 font-medium ${calendarStatus.INACTIVE.cell}`}><StatusDot status="INACTIVE" />Ngừng dùng</div>;
}

function StatusDot({ status }: Readonly<{ status: keyof typeof calendarStatus }>) { return <span className={`size-2 shrink-0 rounded-full ${calendarStatus[status].dot}`} />; }

function Legend({ color, label }: Readonly<{ color: string; label: string }>) { return <span className="inline-flex items-center gap-1.5"><span className={`size-3 rounded ${color}`} />{label}</span>; }
