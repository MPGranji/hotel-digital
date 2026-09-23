"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataMessage } from "@/components/ui/page";
import { getApiErrorMessage } from "@/lib/api-client";
import { useHotelToday } from "@/lib/use-hotel-today";
import { useLiveRevision } from "@/features/realtime/live-updates-provider";
import { getRoomHourlyCalendar, getRooms } from "./rooms-api";
import { bookingAccent, calendarStatus } from "./room-calendar-colors";
import type { RoomHourlyCalendarEvent, RoomHourlyCalendarResponse, RoomListItem } from "./types";

const hourHeight = 56;
const emptyRooms: RoomListItem[] = [];

function localDate(date: Date) {
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
  const liveRevision = useLiveRevision();
  const [roomListResult, setRoomListResult] = useState<{ key: number; items?: RoomListItem[]; error?: string }>();
  const [roomType, setRoomType] = useState("");
  const [floor, setFloor] = useState("");
  const [roomId, setRoomId] = useState("");
  const today = useHotelToday();
  const [selectedWeekDate, setWeekDate] = useState<string | null>(null);
  const weekDate = selectedWeekDate ?? today;
  const [startHour, setStartHour] = useState(6);
  const [endHour, setEndHour] = useState(24);
  const [calendarResult, setCalendarResult] = useState<{ key: string; data?: RoomHourlyCalendarResponse; error?: string }>();
  const [reloadKey, setReloadKey] = useState(0);
  const [roomsReloadKey, setRoomsReloadKey] = useState(0);
  const weekStart = weekDate ? mondayOf(weekDate) : "";

  const currentRoomList = roomListResult?.key === roomsReloadKey ? roomListResult : undefined;
  const rooms = currentRoomList?.items ?? emptyRooms;
  const roomsLoading = !currentRoomList;

  useEffect(() => {
    let active = true;
    void getRooms().then((items) => {
      if (!active) return;
      setRoomListResult({ key: roomsReloadKey, items: items.filter((room) => room.countsTowardOccupancy) });
    }).catch((reason) => { if (active) setRoomListResult({ key: roomsReloadKey, error: getApiErrorMessage(reason, "Không thể tải danh sách phòng.") }); });
    return () => { active = false; };
  }, [roomsReloadKey, liveRevision]);

  const roomTypes = useMemo(() => [...new Set(rooms.map((room) => room.roomTypeName))].sort(), [rooms]);
  const floors = useMemo(() => [...new Set(rooms.map((room) => room.floorLabel).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "vi", { numeric: true })), [rooms]);
  const filteredRooms = useMemo(() => rooms.filter((room) =>
    (!roomType || room.roomTypeName === roomType) && (!floor || room.floorLabel === floor)), [floor, roomType, rooms]);
  const selectedRoomId = filteredRooms.some((room) => String(room.id) === roomId)
    ? roomId
    : filteredRooms[0] ? String(filteredRooms[0].id) : "";
  const calendarKey = `${selectedRoomId}|${weekStart}|${reloadKey}`;
  const currentCalendar = calendarResult?.key === calendarKey ? calendarResult : undefined;
  const data = currentCalendar?.data;
  const error = currentRoomList?.error ?? currentCalendar?.error;
  const loading = roomsLoading || !weekStart || (Boolean(selectedRoomId) && !currentCalendar);

  useEffect(() => {
    if (!selectedRoomId || !weekStart) return;
    let active = true;
    void getRoomHourlyCalendar(Number(selectedRoomId), weekStart)
      .then((response) => { if (active) setCalendarResult({ key: calendarKey, data: response }); })
      .catch((reason) => { if (active) setCalendarResult({ key: calendarKey, error: getApiErrorMessage(reason, "Không thể tải lịch phòng theo giờ.") }); });
    return () => { active = false; };
  }, [calendarKey, selectedRoomId, weekStart, liveRevision]);

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const calendarHeight = (endHour - startHour) * hourHeight;

  function moveWeek(days: number) { setWeekDate(addDays(weekStart, days)); }
  function refresh() {
    if (rooms.length === 0) setRoomsReloadKey((value) => value + 1);
    else setReloadKey((value) => value + 1);
  }

  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="mb-3 shrink-0 rounded-xl border border-slate-200 bg-white p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <label className="text-sm font-medium text-[var(--foreground)]">Hạng phòng<Select className="mt-1.5" onChange={(event) => { setRoomType(event.target.value); setRoomId(""); }} value={roomType}><option value="">Tất cả hạng</option>{roomTypes.map((item) => <option key={item}>{item}</option>)}</Select></label>
        <label className="text-sm font-medium text-[var(--foreground)]">Tầng<Select className="mt-1.5" onChange={(event) => { setFloor(event.target.value); setRoomId(""); }} value={floor}><option value="">Tất cả tầng</option>{floors.map((item) => <option key={item} value={item}>Tầng {item}</option>)}</Select></label>
        <label className="text-sm font-medium text-[var(--foreground)]">Phòng<Select className="mt-1.5" onChange={(event) => setRoomId(event.target.value)} value={selectedRoomId}><option value="">Chọn phòng</option>{filteredRooms.map((room) => <option key={room.id} value={room.id}>{room.roomNumber} · {room.roomTypeName}</option>)}</Select></label>
        <label className="text-sm font-medium text-[var(--foreground)]">Tuần có ngày<Input className="mt-1.5" onChange={(event) => setWeekDate(event.target.value)} type="date" value={weekDate} /></label>
        <label className="text-sm font-medium text-[var(--foreground)]">Từ giờ<Select className="mt-1.5" onChange={(event) => setStartHour(Math.min(Number(event.target.value), endHour - 1))} value={startHour}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}</Select></label>
        <label className="text-sm font-medium text-[var(--foreground)]">Đến giờ<Select className="mt-1.5" onChange={(event) => setEndHour(Math.max(Number(event.target.value), startHour + 1))} value={endHour}>{Array.from({ length: 24 }, (_, index) => index + 1).map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}</Select></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={() => moveWeek(-7)} variant="secondary">← Tuần trước</Button>
        <Button onClick={() => { if (mondayOf(today) === weekStart) refresh(); else setWeekDate(null); }} variant="secondary">Hôm nay</Button>
        <Button onClick={() => moveWeek(7)} variant="secondary">Tuần sau →</Button>
        <div className="ml-auto flex flex-wrap gap-3 text-xs text-slate-600"><Legend color={calendarStatus.BOOKED.dot} label="Đã đặt" /><Legend color={calendarStatus.CHECKED_IN.dot} label="Đang ở" /><Legend color={calendarStatus.CHECKED_OUT.dot} label="Đã trả (giữ đến giờ đi)" /><Legend color={calendarStatus.MAINTENANCE.dot} label="Bảo trì" /><span>Vạch màu: cùng lượt đặt</span></div>
      </div>
    </div>

    {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Không thể tải lịch theo giờ" /> : rooms.length === 0 && loading ? <DataMessage title="Đang tải danh sách phòng…" /> : !selectedRoomId ? <DataMessage description="Thử thay đổi hạng phòng hoặc tầng." title="Không có phòng phù hợp" /> : loading ? <DataMessage title="Đang tải lịch phòng theo giờ…" /> : data ? <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="min-w-[980px]">
        <div className="sticky top-0 z-30 grid grid-cols-[72px_repeat(7,minmax(128px,1fr))] border-b border-slate-200 bg-slate-50">
          <div className="border-r border-slate-200 px-2 py-3 text-center text-xs font-medium text-slate-500">Giờ</div>
          {data.dates.map((date) => <div className={`border-r border-slate-200 px-2 py-3 text-center text-sm font-medium capitalize ${date === today ? "bg-[var(--nav-active)] text-[var(--primary-strong)]" : "text-slate-700"}`} key={date}>{dayHeading(date)}</div>)}
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
  </div>;
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
  const checkedOut = event.status === "CHECKED_OUT";
  const maintenance = event.kind === "MAINTENANCE";
  const classes = maintenance ? calendarStatus.MAINTENANCE.cell : checkedIn ? calendarStatus.CHECKED_IN.cell : checkedOut ? calendarStatus.CHECKED_OUT.cell : calendarStatus.BOOKED.cell;
  const label = maintenance ? "Bảo trì" : checkedIn ? "Đang ở" : checkedOut ? "Đã trả" : "Đã đặt";
  const content = <><b className="block truncate text-xs">{label}{maintenance ? "" : ` · ${event.customerName}`}</b><span className="block truncate text-[10px] opacity-80">{timeLabel(event.startAt)}–{timeLabel(event.endAt)}{maintenance ? ` · ${event.maintenanceReason}` : ` · ${event.bookingCode}`}</span></>;
  if (event.bookingId) return <Link aria-label={`${label}: ${event.customerName}, ${event.bookingCode}, ${timeLabel(event.startAt)} đến ${timeLabel(event.endAt)}`} className={`absolute inset-x-1 z-10 overflow-hidden rounded-md border border-[var(--border)] border-l-4 px-2 py-1 shadow-sm ${classes}`} href={`/bookings?bookingId=${event.bookingId}`} style={{ top, height, borderLeftColor: bookingAccent(event.bookingId) }} title={`${label} · ${event.customerName} · ${event.bookingCode}`}>{content}</Link>;
  return <div className={`absolute inset-x-1 z-10 overflow-hidden rounded-md border border-[var(--border)] px-2 py-1 shadow-sm ${classes}`} style={{ top, height }} title={event.maintenanceReason}>{content}</div>;
}

function Legend({ color, label }: Readonly<{ color: string; label: string }>) {
  return <span className="inline-flex items-center gap-1.5"><span className={`size-2.5 rounded ${color}`} />{label}</span>;
}
