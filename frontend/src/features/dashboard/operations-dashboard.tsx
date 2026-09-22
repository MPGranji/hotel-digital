"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataMessage, Panel } from "@/components/ui/page";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { getRooms } from "@/features/rooms/rooms-api";
import type { RoomListItem } from "@/features/rooms/types";

const statusMeta: Record<RoomListItem["status"], { label: string; badge: string; edge: string }> = {
  AVAILABLE: { label: "Trống", badge: "border-[#bdd1cb] bg-[#edf5f2] text-[#24544d]", edge: "border-l-[#2f5d62]" },
  RESERVED: { label: "Đã đặt", badge: "border-[#d8c6a7] bg-[#faf4e9] text-[#755b2e]", edge: "border-l-[#b08d57]" },
  OCCUPIED: { label: "Đang có khách", badge: "border-[#bbd0bd] bg-[#edf4ed] text-[#365c42]", edge: "border-l-[#5f8d7a]" },
  MAINTENANCE: { label: "Bảo trì", badge: "border-[#dfc0b9] bg-[#f9efec] text-[#8c493e]", edge: "border-l-[#b85c4a]" },
  INACTIVE: { label: "Ngừng dùng", badge: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--nav-text)]", edge: "border-l-[#a5aaa5]" },
};

export function OperationsDashboard() {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RoomListItem["status"] | "ALL">("ALL");

  useEffect(() => {
    let active = true;
    void getRooms()
      .then((items) => { if (active) setRooms(items); })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, "Không thể tải hiện trạng phòng.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const physicalRooms = useMemo(
    () => rooms.filter((room) => room.countsTowardOccupancy && room.isActive),
    [rooms],
  );
  const counts = useMemo(() => ({
    physical: physicalRooms.length,
    occupied: physicalRooms.filter((room) => room.status === "OCCUPIED").length,
    reserved: physicalRooms.filter((room) => room.status === "RESERVED").length,
    available: physicalRooms.filter((room) => room.status === "AVAILABLE").length,
    maintenance: physicalRooms.filter((room) => room.status === "MAINTENANCE").length,
  }), [physicalRooms]);
  const visibleRooms = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("vi");
    return rooms.filter((room) => {
      if (statusFilter !== "ALL" && room.status !== statusFilter) return false;
      if (!term) return true;
      return [room.roomNumber, room.currentGuestName, room.currentGuestPhone, room.currentBookingCode]
        .some((value) => value?.toLocaleLowerCase("vi").includes(term));
    });
  }, [query, rooms, statusFilter]);

  function refresh() {
    setLoading(true);
    setError(undefined);
    setReloadKey((value) => value + 1);
  }

  return (
    <div className="space-y-5">
      <Panel className="!p-0">
        <div className="grid grid-cols-2 divide-x divide-y divide-[var(--border)] sm:grid-cols-3 xl:grid-cols-5 xl:divide-y-0">
          <Metric label="Phòng hoạt động" value={!loading && !error ? counts.physical : undefined} />
          <Metric label="Đang có khách" value={!loading && !error ? counts.occupied : undefined} />
          <Metric label="Đã đặt" value={!loading && !error ? counts.reserved : undefined} />
          <Metric label="Phòng trống" value={!loading && !error ? counts.available : undefined} />
          <Metric label="Bảo trì" value={!loading && !error ? counts.maintenance : undefined} />
        </div>
      </Panel>

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Danh sách phòng</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Tìm khách hoặc phòng cần xem. Nhấn Làm mới khi bạn muốn cập nhật trạng thái.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={refresh} variant="secondary">Làm mới</Button>
          <Link className="inline-flex min-h-10 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-strong)]" href="/rooms">Quản lý phòng</Link>
        </div>
      </div>

      <Panel>
        <div className="mb-5 flex flex-col gap-3 border-b border-[var(--border)] pb-5 sm:flex-row">
          <Input aria-label="Tìm phòng hoặc khách" className="sm:max-w-md" onChange={(event) => setQuery(event.target.value)} placeholder="Số phòng, tên khách, SĐT hoặc mã đặt phòng" value={query} />
          <Select aria-label="Lọc theo trạng thái phòng" className="sm:max-w-56" onChange={(event) => setStatusFilter(event.target.value as RoomListItem["status"] | "ALL")} value={statusFilter}>
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(statusMeta).map(([status, meta]) => <option key={status} value={status}>{meta.label}</option>)}
          </Select>
          {!loading && !error ? <p className="self-center text-sm text-[var(--muted)] sm:ml-auto">{visibleRooms.length} phòng</p> : null}
        </div>

        {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Chưa tải được tình trạng phòng" /> : loading ? <DataMessage title="Đang lấy tình trạng phòng…" /> : visibleRooms.length === 0 ? <DataMessage description={rooms.length === 0 ? "Danh sách phòng hiện chưa có dữ liệu." : "Bạn thử từ khóa hoặc trạng thái khác nhé."} title={rooms.length === 0 ? "Chưa có phòng nào" : "Không tìm thấy phòng phù hợp"} /> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleRooms.map((room) => {
              const meta = statusMeta[room.status];
              return <article className={`flex min-h-56 flex-col rounded-xl border border-l-4 border-[var(--border)] bg-[var(--sidebar)] p-4 ${meta.edge}`} key={room.id}>
                <div className="flex items-start justify-between gap-2">
                  <div><h3 className="text-xl font-semibold tracking-tight">Phòng {room.roomNumber}</h3><p className="mt-0.5 text-xs text-[var(--muted)]">{room.roomTypeName}{room.floorLabel ? ` · Tầng ${room.floorLabel}` : ""}</p></div>
                  <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${meta.badge}`}>{meta.label}</span>
                </div>
                <div className="mt-5 flex-1 text-sm">
                  {room.currentGuestName ? <>
                    <p className="font-semibold text-[var(--foreground)]">{room.currentGuestName}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{room.currentGuestPhone || "Chưa có số điện thoại"}{room.currentBookingCode ? ` · ${room.currentBookingCode}` : ""}</p>
                    <StayPeriod end={room.currentCheckOutAt} start={room.currentCheckInAt} />
                  </> : room.nextCheckInAt ? <>
                    <p className="font-medium">Lượt đặt tiếp theo</p>
                    <StayPeriod end={room.nextCheckOutAt} start={room.nextCheckInAt} />
                  </> : <p className="text-[var(--muted)]">Chưa có lượt đặt tiếp theo.</p>}
                </div>
                {room.currentBookingId ? <Link className="mt-4 w-fit text-sm font-semibold text-[var(--primary)] underline-offset-4 hover:underline" href={`/bookings?bookingId=${room.currentBookingId}&mode=view`}>Xem đặt phòng</Link> : null}
              </article>;
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function StayPeriod({ start, end }: Readonly<{ start?: string; end?: string }>) {
  return <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{formatDateTime(start)} → {formatDateTime(end)}</p>;
}

function Metric({ label, value }: Readonly<{ label: string; value?: number }>) {
  return <div className="min-w-0 px-4 py-5 sm:px-5"><p className="text-xs font-medium text-[var(--muted)]">{label}</p><p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-tight text-[var(--foreground)] tabular-nums">{value ?? "—"}</p></div>;
}
