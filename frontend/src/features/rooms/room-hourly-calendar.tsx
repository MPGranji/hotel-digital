"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataMessage } from "@/components/ui/page";
import { getApiErrorMessage } from "@/lib/api-client";
import { getRoomHourlyCalendar, getRooms } from "./rooms-api";
import type { RoomHourlyCalendarEvent, RoomHourlyCalendarResponse, RoomListItem } from "./types";

const hourHeight = 56;

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function mondayOf(value: string) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return localDate(date);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function dayHeading(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${value}T00:00:00`));
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

export function RoomHourlyCalendar() {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [roomType, setRoomType] = useState("");
  const [floor, setFloor] = useState("");
  const [roomId, setRoomId] = useState("");
  const [weekDate, setWeekDate] = useState(localDate());
  const [startHour, setStartHour] = useState(6);
  const [endHour, setEndHour] = useState(24);
  const [data, setData] = useState<RoomHourlyCalendarResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const weekStart = mondayOf(weekDate);

  useEffect(() => {
    let active = true;
    void getRooms().then((items) => {
      if (!active) return;
      setRooms(items.filter((room) => room.countsTowardOccupancy));
      setRoomId((current) => current || String(items.find((room) => room.isActive && room.countsTowardOccupancy)?.id ?? ""));
    }).catch((reason) => { setError(getApiErrorMessage(reason, "Không thể tải danh sách phòng.")); setLoading(false); });
    return () => { active = false; };
  }, []);

  const roomTypes = useMemo(() => [...new Set(rooms.map((room) => room.roomTypeName))].sort(), [rooms]);
  const floors = useMemo(() => [...new Set(rooms.map((room) => room.floorLabel).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "vi", { numeric: true })), [rooms]);
  const filteredRooms = useMemo(() => rooms.filter((room) =>
    (!roomType || room.roomTypeName === roomType) && (!floor || room.floorLabel === floor)), [floor, roomType, rooms]);
  const selectedRoomId = filteredRooms.some((room) => String(room.id) === roomId)
    ? roomId
    : filteredRooms[0] ? String(filteredRooms[0].id) : "";

  useEffect(() => {
    if (!selectedRoomId) return;
    let active = true;
    void getRoomHourlyCalendar(Number(selectedRoomId), weekStart)
      .then((result) => { if (active) setData(result); })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, "Không thể tải lịch phòng theo giờ.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey, selectedRoomId, weekStart]);

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const calendarHeight = (endHour - startHour) * hourHeight;

  function moveWeek(days: number) { setLoading(true); setError(undefined); setWeekDate(addDays(weekStart, days)); }
  function refresh() { setLoading(true); setError(undefined); setReloadKey((value) => value + 1); }

  return <>
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Hạng phòng<Select className="mt-1" onChange={(event) => { setRoomType(event.target.value); setRoomId(""); setLoading(true); }} value={roomType}><option value="">Tất cả hạng</option>{roomTypes.map((item) => <option key={item}>{item}</option>)}</Select></label>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Tầng<Select className="mt-1" onChange={(event) => { setFloor(event.target.value); setRoomId(""); setLoading(true); }} value={floor}><option value="">Tất cả tầng</option>{floors.map((item) => <option key={item} value={item}>Tầng {item}</option>)}</Select></label>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Phòng<Select className="mt-1" onChange={(event) => { setRoomId(event.target.value); setLoading(true); }} value={selectedRoomId}><option value="">Chọn phòng</option>{filteredRooms.map((room) => <option key={room.id} value={room.id}>{room.roomNumber} · {room.roomTypeName}</option>)}</Select></label>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Tuần có ngày<Input className="mt-1" onChange={(event) => { setLoading(true); setError(undefined); setWeekDate(event.target.value); }} type="date" value={weekDate} /></label>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Từ giờ<Select className="mt-1" onChange={(event) => setStartHour(Math.min(Number(event.target.value), endHour - 1))} value={startHour}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}</Select></label>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Đến giờ<Select className="mt-1" onChange={(event) => setEndHour(Math.max(Number(event.target.value), startHour + 1))} value={endHour}>{Array.from({ length: 24 }, (_, index) => index + 1).map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}</Select></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={() => moveWeek(-7)} variant="secondary">← Tuần trước</Button>
        <Button onClick={() => { setLoading(true); setError(undefined); setWeekDate(localDate()); }} variant="secondary">Hôm nay</Button>
        <Button onClick={() => moveWeek(7)} variant="secondary">Tuần sau →</Button>
        <div className="ml-auto flex flex-wrap gap-3 text-xs text-slate-600"><Legend color="bg-blue-400" label="Đã đặt" /><Legend color="bg-amber-400" label="Đang ở" /><Legend color="bg-rose-400" label="Bảo trì" /></div>
      </div>
    </div>

    {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Không thể tải lịch theo giờ" /> : rooms.length === 0 && loading ? <DataMessage title="Đang tải danh sách phòng…" /> : !selectedRoomId ? <DataMessage description="Thử thay đổi hạng phòng hoặc tầng." title="Không có phòng phù hợp" /> : loading ? <DataMessage title="Đang tải lịch phòng theo giờ…" /> : data ? <div className="max-h-[68vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="min-w-[980px]">
        <div className="sticky top-0 z-30 grid grid-cols-[72px_repeat(7,minmax(128px,1fr))] border-b border-slate-200 bg-slate-50">
          <div className="border-r border-slate-200 px-2 py-3 text-center text-xs font-medium text-slate-500">Giờ</div>
          {data.dates.map((date) => <div className={`border-r border-slate-200 px-2 py-3 text-center text-sm font-semibold capitalize ${date === localDate() ? "bg-blue-50 text-blue-700" : "text-slate-700"}`} key={date}>{dayHeading(date)}</div>)}
        </div>
        {!data.isActive ? <p className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-600">Phòng {data.roomNumber} đang ngừng hoạt động.</p> : null}
        <div className="grid grid-cols-[72px_repeat(7,minmax(128px,1fr))]" style={{ height: calendarHeight }}>
          <div className="relative border-r border-slate-200 bg-slate-50/70">
            {hours.map((hour) => <span className={`absolute right-2 text-[11px] tabular-nums text-slate-500 ${hour !== startHour && hour !== endHour ? "-translate-y-1/2" : ""}`} key={hour} style={hour === startHour ? { top: 4 } : hour === endHour ? { bottom: 4 } : { top: (hour - startHour) * hourHeight }}>{String(hour).padStart(2, "0")}:00</span>)}
          </div>
          {data.dates.map((date) => <DayColumn date={date} endHour={endHour} events={data.events} key={date} startHour={startHour} />)}
        </div>
      </div>
    </div> : null}
  </>;
}

function DayColumn({ date, events, startHour, endHour }: Readonly<{ date: string; events: RoomHourlyCalendarEvent[]; startHour: number; endHour: number }>) {
  const dayStart = new Date(`${date}T00:00:00`);
  const visibleStart = new Date(dayStart); visibleStart.setHours(startHour);
  const visibleEnd = new Date(dayStart); visibleEnd.setHours(endHour);
  const segments = events.map((event) => {
    const start = Math.max(new Date(event.startAt).getTime(), visibleStart.getTime());
    const end = Math.min(new Date(event.endAt).getTime(), visibleEnd.getTime());
    return start < end ? { event, start, end } : undefined;
  }).filter(Boolean) as Array<{ event: RoomHourlyCalendarEvent; start: number; end: number }>;

  return <div className="relative border-r border-slate-200" style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${hourHeight - 1}px, #e2e8f0 ${hourHeight - 1}px, #e2e8f0 ${hourHeight}px)` }}>
    {segments.map(({ event, start, end }) => {
      const top = ((start - visibleStart.getTime()) / 3_600_000) * hourHeight;
      const height = Math.max(((end - start) / 3_600_000) * hourHeight, 24);
      return <CalendarEvent event={event} height={height} key={`${event.kind}-${event.bookingId ?? event.roomBlockId}-${event.startAt}`} top={top} />;
    })}
  </div>;
}

function CalendarEvent({ event, top, height }: Readonly<{ event: RoomHourlyCalendarEvent; top: number; height: number }>) {
  const checkedIn = event.status === "CHECKED_IN";
  const maintenance = event.kind === "MAINTENANCE";
  const classes = maintenance ? "border-rose-300 bg-rose-100 text-rose-900" : checkedIn ? "border-amber-300 bg-amber-100 text-amber-950" : "border-blue-300 bg-blue-100 text-blue-900";
  const content = <><b className="block truncate text-xs">{maintenance ? "Bảo trì" : event.customerName}</b><span className="block truncate text-[10px] opacity-80">{timeLabel(event.startAt)}–{timeLabel(event.endAt)}{maintenance ? ` · ${event.maintenanceReason}` : ` · ${event.bookingCode}`}</span></>;
  const style = { top, height };
  if (event.bookingId) return <Link className={`absolute inset-x-1 z-10 overflow-hidden rounded-md border px-2 py-1 shadow-sm hover:brightness-95 ${classes}`} href={`/bookings?bookingId=${event.bookingId}`} style={style} title={`${event.customerName} · ${event.bookingCode}`}>{content}</Link>;
  return <div className={`absolute inset-x-1 z-10 overflow-hidden rounded-md border px-2 py-1 shadow-sm ${classes}`} style={style} title={event.maintenanceReason}>{content}</div>;
}

function Legend({ color, label }: Readonly<{ color: string; label: string }>) {
  return <span className="inline-flex items-center gap-1.5"><span className={`size-2.5 rounded ${color}`} />{label}</span>;
}
