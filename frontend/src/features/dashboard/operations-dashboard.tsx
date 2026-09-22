"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataMessage, Panel } from "@/components/ui/page";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { getRooms } from "@/features/rooms/rooms-api";
import type { RoomListItem } from "@/features/rooms/types";

const statusMeta: Record<RoomListItem["status"], { label: string; className: string }> = {
  AVAILABLE: { label: "Trống", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  RESERVED: { label: "Đã đặt", className: "border-blue-200 bg-blue-50 text-blue-800" },
  OCCUPIED: { label: "Đang có khách", className: "border-amber-200 bg-amber-50 text-amber-900" },
  MAINTENANCE: { label: "Bảo trì", className: "border-rose-200 bg-rose-50 text-rose-800" },
  INACTIVE: { label: "Ngừng hoạt động", className: "border-slate-200 bg-slate-100 text-slate-600" },
};

export function OperationsDashboard() {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void getRooms()
      .then((items) => { if (active) setRooms(items); })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, "Không thể tải hiện trạng phòng.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const counts = useMemo(() => ({
    physical: rooms.filter((room) => room.countsTowardOccupancy && room.isActive).length,
    occupied: rooms.filter((room) => room.status === "OCCUPIED").length,
    reserved: rooms.filter((room) => room.status === "RESERVED").length,
    available: rooms.filter((room) => room.status === "AVAILABLE").length,
    maintenance: rooms.filter((room) => room.status === "MAINTENANCE").length,
  }), [rooms]);

  function refresh() {
    setLoading(true);
    setError(undefined);
    setReloadKey((value) => value + 1);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Dữ liệu nội bộ theo thời điểm hiện tại; tên khách không được gửi sang báo cáo Power BI công khai.</p>
        <div className="flex gap-2"><Button onClick={refresh} variant="secondary">Làm mới</Button><Link className="inline-flex min-h-10 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-white" href="/rooms">Mở lịch phòng</Link></div>
      </div>

      {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Không thể tải dữ liệu" /> : loading ? <DataMessage title="Đang tải hiện trạng khách và phòng…" /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Phòng hoạt động" value={counts.physical} />
            <Metric label="Đang có khách" value={counts.occupied} tone="amber" />
            <Metric label="Đã đặt" value={counts.reserved} tone="blue" />
            <Metric label="Phòng trống" value={counts.available} tone="green" />
            <Metric label="Bảo trì" value={counts.maintenance} tone="red" />
          </div>

          <Panel>
            {rooms.length === 0 ? <DataMessage title="Chưa có dữ liệu phòng" /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rooms.map((room) => {
                const meta = statusMeta[room.status];
                return <article className={`rounded-xl border p-4 ${meta.className}`} key={room.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xl font-bold">Phòng {room.roomNumber}</p><p className="text-xs opacity-75">{room.roomTypeName}{room.floorLabel ? ` · Tầng ${room.floorLabel}` : ""}</p></div>
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold">{meta.label}</span>
                  </div>
                  <div className="mt-4 min-h-14 text-sm">
                    {room.currentGuestName ? <><p className="font-semibold">{room.currentGuestName}</p><p className="text-xs opacity-75">{room.currentBookingCode}</p></> : room.nextCheckInAt ? <><p className="font-medium">Booking kế tiếp</p><p className="text-xs opacity-75">{formatDateTime(room.nextCheckInAt)}</p></> : <p className="opacity-75">Chưa có khách hoặc booking kế tiếp.</p>}
                  </div>
                  {room.currentBookingId ? <Link className="mt-3 inline-flex text-sm font-semibold underline underline-offset-2" href={`/bookings?bookingId=${room.currentBookingId}&mode=view`}>Xem booking</Link> : null}
                </article>;
              })}
            </div>}
          </Panel>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, tone = "slate" }: Readonly<{ label: string; value: number; tone?: "slate" | "amber" | "blue" | "green" | "red" }>) {
  const classes = {
    slate: "border-slate-200 bg-white text-slate-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    red: "border-rose-200 bg-rose-50 text-rose-900",
  };
  return <div className={`rounded-xl border p-4 shadow-sm ${classes[tone]}`}><p className="text-sm font-medium opacity-75">{label}</p><p className="mt-1 text-3xl font-bold tabular-nums">{value}</p></div>;
}
