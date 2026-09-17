"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataMessage } from "@/components/ui/page";
import { getApiErrorMessage } from "@/lib/api-client";
import { RoomBlockEditor } from "./room-block-editor";
import { getRoomCalendar } from "./rooms-api";
import type { RoomCalendarCell, RoomCalendarResponse, RoomListItem } from "./types";

const statusStyles = {
  AVAILABLE: "border-emerald-200 bg-emerald-50 text-emerald-800",
  BOOKED: "border-blue-200 bg-blue-50 text-blue-800",
  CHECKED_IN: "border-amber-200 bg-amber-50 text-amber-900",
  MAINTENANCE: "border-rose-200 bg-rose-50 text-rose-800",
  INACTIVE: "border-slate-200 bg-slate-100 text-slate-500",
};

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${value}T00:00:00`));
}

interface EditorTarget { blockId?: number; roomId?: number; date?: string }

export function RoomCalendar({ rooms }: Readonly<{ rooms: RoomListItem[] }>) {
  const [dateFrom, setDateFrom] = useState(localDate());
  const [days, setDays] = useState(14);
  const [data, setData] = useState<RoomCalendarResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [editor, setEditor] = useState<EditorTarget>();

  useEffect(() => {
    let active = true;
    void getRoomCalendar(dateFrom, days).then((result) => { if (active) setData(result); }).catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải ma trận phòng."))).finally(() => setLoading(false));
    return () => { active = false; };
  }, [dateFrom, days, reloadKey]);

  function refresh() { setLoading(true); setError(undefined); setReloadKey((value) => value + 1); }

  return <>
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-end">
      <label className="text-sm font-medium text-slate-700">Từ ngày<Input className="mt-1 md:w-48" onChange={(e) => { setLoading(true); setError(undefined); setDateFrom(e.target.value); }} type="date" value={dateFrom} /></label>
      <label className="text-sm font-medium text-slate-700">Khoảng xem<Select className="mt-1 md:w-40" onChange={(e) => { setLoading(true); setError(undefined); setDays(Number(e.target.value)); }} value={days}><option value={7}>7 ngày</option><option value={14}>14 ngày</option><option value={21}>21 ngày</option><option value={31}>31 ngày</option></Select></label>
      <div className="flex flex-wrap gap-3 text-xs text-slate-600 md:ml-3 md:pb-2"><Legend color="bg-emerald-100" label="Trống" /><Legend color="bg-blue-100" label="Đã đặt" /><Legend color="bg-amber-100" label="Đang ở" /><Legend color="bg-rose-100" label="Bảo trì" /></div>
      <Button className="md:ml-auto" onClick={() => setEditor({})}>Thêm lịch bảo trì</Button>
    </div>
    {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Không thể tải ma trận" /> : loading ? <DataMessage title="Đang kiểm tra lịch phòng…" /> : !data?.rooms.length ? <DataMessage title="Chưa có phòng để hiển thị" /> : <div className="max-h-[68vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="border-separate border-spacing-0 text-left text-xs">
        <thead className="sticky top-0 z-20 bg-slate-50"><tr><th className="sticky left-0 z-30 min-w-40 border-b border-r border-slate-200 bg-slate-50 px-3 py-3">Phòng</th>{data.dates.map((date) => <th className="min-w-32 border-b border-r border-slate-200 px-2 py-3 text-center font-semibold capitalize text-slate-600" key={date}>{dateLabel(date)}</th>)}</tr></thead>
        <tbody>{data.rooms.map((room) => <tr key={room.roomId}><th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2"><b className="block text-sm text-slate-900">Phòng {room.roomNumber}</b><span className="font-normal text-slate-500">{room.roomTypeName}{room.floorLabel ? ` · Tầng ${room.floorLabel}` : ""}</span></th>{room.cells.map((cell) => <td className="border-b border-r border-slate-200 p-1.5" key={cell.date}><CalendarCell cell={cell} roomId={room.roomId} onMaintenance={() => setEditor(cell.roomBlockId ? { blockId: cell.roomBlockId } : { roomId: room.roomId, date: cell.date })} /></td>)}</tr>)}</tbody>
      </table>
    </div>}
    {editor ? <RoomBlockEditor blockId={editor.blockId} initialDate={editor.date} initialRoomId={editor.roomId} onClose={() => setEditor(undefined)} onSaved={() => { setEditor(undefined); refresh(); }} rooms={rooms} /> : null}
  </>;
}

function CalendarCell({ cell, roomId, onMaintenance }: Readonly<{ cell: RoomCalendarCell; roomId: number; onMaintenance: () => void }>) {
  if (cell.status === "AVAILABLE") {
    const checkout = addDays(cell.date, 1);
    return <div className={`min-h-20 rounded-lg border p-2 ${statusStyles.AVAILABLE}`}><p className="font-semibold">Trống</p><div className="mt-2 flex gap-1"><Link className="rounded bg-emerald-700 px-2 py-1 font-semibold text-white" href={`/bookings?roomId=${roomId}&checkInDate=${cell.date}&checkOutDate=${checkout}`}>Đặt</Link><button className="rounded border border-rose-200 bg-white px-2 py-1 font-semibold text-rose-700" onClick={onMaintenance} type="button">Bảo trì</button></div></div>;
  }
  if (cell.status === "MAINTENANCE") return <button className={`block min-h-20 w-full rounded-lg border p-2 text-left ${statusStyles.MAINTENANCE}`} onClick={onMaintenance} title={cell.maintenanceReason} type="button"><b className="block">Bảo trì</b><span className="mt-1 line-clamp-2 block">{cell.maintenanceReason}</span></button>;
  if (cell.bookingId) return <Link className={`block min-h-20 rounded-lg border p-2 ${statusStyles[cell.status]}`} href={`/bookings?bookingId=${cell.bookingId}`} title={`${cell.bookingCode} · ${cell.customerName}`}><b className="block">{cell.status === "CHECKED_IN" ? "Đang ở" : "Đã đặt"}</b><span className="mt-1 block truncate">{cell.customerName}</span><span className="block text-[10px] opacity-75">{cell.bookingCode}</span></Link>;
  return <div className={`min-h-20 rounded-lg border p-2 ${statusStyles.INACTIVE}`}><b>Ngừng dùng</b></div>;
}

function Legend({ color, label }: Readonly<{ color: string; label: string }>) { return <span className="inline-flex items-center gap-1.5"><span className={`size-3 rounded ${color}`} />{label}</span>; }
