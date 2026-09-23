"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/page";
import { useLiveRevision, useLiveStatus } from "@/features/realtime/live-updates-provider";
import { getRooms } from "@/features/rooms/rooms-api";
import type { RoomListItem } from "@/features/rooms/types";
import { getApiErrorMessage } from "@/lib/api-client";

type RoomStatus = Exclude<RoomListItem["status"], "INACTIVE">;

const statuses: Array<{ key: RoomStatus; label: string; color: string }> = [
  { key: "AVAILABLE", label: "Trống", color: "bg-[#82939b]" },
  { key: "RESERVED", label: "Đã đặt", color: "bg-[#b08d57]" },
  { key: "OCCUPIED", label: "Đang ở", color: "bg-[#5f8d7a]" },
  { key: "HELD", label: "Tạm giữ", color: "bg-[#7d90a5]" },
  { key: "MAINTENANCE", label: "Bảo trì", color: "bg-[#b85c4a]" },
];

export function LiveRoomOverview() {
  const revision = useLiveRevision();
  const liveStatus = useLiveStatus();
  const [rooms, setRooms] = useState<RoomListItem[]>();
  const [error, setError] = useState<string>();
  const [updatedAt, setUpdatedAt] = useState<Date>();

  useEffect(() => {
    let active = true;
    void getRooms()
      .then((result) => {
        if (!active) return;
        setRooms(result);
        setUpdatedAt(new Date());
        setError(undefined);
      })
      .catch((reason) => {
        if (active) setError(getApiErrorMessage(reason, "Không thể tải hiện trạng phòng."));
      });
    return () => { active = false; };
  }, [revision]);

  const businessRooms = rooms?.filter((room) => room.isActive && room.countsTowardOccupancy) ?? [];
  const counts = Object.fromEntries(statuses.map(({ key }) => [key, businessRooms.filter((room) => room.status === key).length])) as Record<RoomStatus, number>;
  const displayedRooms = [...businessRooms].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, "vi", { numeric: true }));

  return <section aria-labelledby="live-rooms-title" className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)]" id="live-rooms-title">Theo dõi phòng trực tiếp</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Tự cập nhật khi đặt phòng, nhận phòng hoặc trả phòng.</p>
      </div>
      <div className="text-right text-xs text-[var(--muted)]">
        <p>{liveStatus === "connected" ? "Đang nhận cập nhật trực tiếp" : "Đang kết nối lại · tự đối chiếu dữ liệu"}</p>
        {updatedAt ? <p>Dữ liệu tải lúc {updatedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</p> : null}
      </div>
    </div>

    {error ? <p className="rounded-lg border border-[#dfc0b9] bg-[#f9efec] px-4 py-3 text-sm text-[#8c493e]" role="alert">{error}{rooms ? " Số liệu bên dưới có thể đã cũ." : ""}</p> : null}
    {!rooms ? <div aria-label="Đang tải hiện trạng phòng" className="h-52 animate-pulse rounded-xl bg-[var(--surface-muted)]" role="status" /> : <>
      <div className="grid gap-3 sm:grid-cols-3">
        <RoomMetric label="Phòng kinh doanh" value={businessRooms.length} />
        <RoomMetric label="Đang ở" value={counts.OCCUPIED} />
        <RoomMetric label="Còn trống" value={counts.AVAILABLE} />
      </div>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Tình trạng phòng</h3><Link className="text-sm font-semibold text-[var(--primary)] hover:underline" href="/room-status">Xem lịch phòng →</Link></div>
        <div aria-label="Tỷ lệ phòng theo trạng thái" className="mt-4 flex h-4 overflow-hidden rounded-full bg-[var(--surface-muted)]" role="img">
          {statuses.map((status) => counts[status.key] > 0 ? <div className={status.color} key={status.key} style={{ width: `${counts[status.key] / businessRooms.length * 100}%` }} title={`${status.label}: ${counts[status.key]}`} /> : null)}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {statuses.map((status) => <span className="inline-flex items-center gap-2" key={status.key}><span className={`size-2.5 rounded-full ${status.color}`} />{status.label} <strong className="tabular-nums">{counts[status.key]}</strong></span>)}
        </div>
      </Panel>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {displayedRooms.map((room) => {
          const status = statuses.find((item) => item.key === room.status)!;
          return <Panel className="!p-4" key={room.id}>
            <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">Phòng {room.roomNumber}</h3><p className="text-xs text-[var(--muted)]">{room.roomTypeName}{room.floorLabel ? ` · Tầng ${room.floorLabel}` : ""}</p></div><span className={`mt-1 size-2.5 shrink-0 rounded-full ${status.color}`} /></div>
            <p className="mt-3 text-sm font-medium">{status.label}</p>
            {room.currentGuestName ? <p className="mt-1 truncate text-xs text-[var(--muted)]">{room.currentGuestName}</p> : null}
          </Panel>;
        })}
      </div>
    </>}
  </section>;
}

function RoomMetric({ label, value }: Readonly<{ label: string; value: number }>) {
  return <Panel className="!p-4"><p className="text-sm text-[var(--muted)]">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-[var(--primary-strong)]">{value}</p></Panel>;
}
