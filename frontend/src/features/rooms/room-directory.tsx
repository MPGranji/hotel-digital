"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataMessage, PageHeader, Panel } from "@/components/ui/page";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { RoomEditor } from "./room-editor";
import { RoomCalendar } from "./room-calendar";
import { RoomMaintenance } from "./room-maintenance";
import { RoomTypeManager } from "./room-type-manager";
import { getRooms } from "./rooms-api";
import type { RoomListItem } from "./types";

const statusLabels = {
  AVAILABLE: "Trống",
  RESERVED: "Đã đặt",
  OCCUPIED: "Đang có khách",
  MAINTENANCE: "Bảo trì",
  INACTIVE: "Ngừng hoạt động",
};

const statusStyles = {
  AVAILABLE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  RESERVED: "border-blue-200 bg-blue-50 text-blue-700",
  OCCUPIED: "border-amber-200 bg-amber-50 text-amber-800",
  MAINTENANCE: "border-rose-200 bg-rose-50 text-rose-700",
  INACTIVE: "border-slate-200 bg-slate-100 text-slate-600",
};

export function RoomDirectory() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<RoomListItem | "new">();
  const [managingTypes, setManagingTypes] = useState(false);
  const [view, setView] = useState<"list" | "calendar" | "maintenance">("list");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    void getRooms(search, status)
      .then((data) => { if (active) setRooms(data); })
      .catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải danh sách phòng.")))
      .finally(() => setLoading(false));
    return () => { active = false; };
  }, [reloadKey, search, status]);

  function refresh() {
    setLoading(true);
    setError(undefined);
    setReloadKey((value) => value + 1);
  }

  return (
    <>
      <PageHeader actions={<><Button onClick={() => setManagingTypes(true)} variant="secondary">Hạng phòng</Button><Button onClick={() => setEditing("new")}>Thêm phòng</Button></>} description="Quản lý phòng, theo dõi hiện trạng và thiết lập lịch bảo trì." title="Phòng" />
      <nav aria-label="Chế độ quản lý phòng" className="mb-4 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <ViewButton active={view === "list"} label="Danh sách phòng" onClick={() => setView("list")} />
        <ViewButton active={view === "calendar"} label="Hiện trạng phòng" onClick={() => setView("calendar")} />
        <ViewButton active={view === "maintenance"} label="Lịch bảo trì" onClick={() => setView("maintenance")} />
      </nav>
      {view === "calendar" ? <RoomCalendar /> : view === "maintenance" ? <RoomMaintenance rooms={rooms} /> : (
      <Panel>
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-center">
          <Input aria-label="Tìm phòng" className="md:max-w-sm" onChange={(event) => { setQuery(event.target.value); setLoading(true); }} placeholder="Tìm số phòng, hạng phòng hoặc tầng" value={query} />
          <Select aria-label="Trạng thái phòng" className="md:max-w-xs" onChange={(event) => { setStatus(event.target.value); setLoading(true); }} value={status}><option value="">Tất cả trạng thái</option><option value="AVAILABLE">Trống</option><option value="RESERVED">Đã đặt</option><option value="OCCUPIED">Đang có khách</option><option value="MAINTENANCE">Bảo trì</option><option value="INACTIVE">Ngừng hoạt động</option></Select>
          <Button className="md:ml-auto" onClick={refresh} variant="secondary">Làm mới</Button>
        </div>
        {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Không thể tải dữ liệu" /> : loading ? <DataMessage title="Đang tải danh sách phòng…" /> : rooms.length === 0 ? <DataMessage description="Thử thay đổi từ khóa hoặc trạng thái." title="Không có phòng phù hợp" /> : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Phòng</th><th className="px-4 py-3">Hạng phòng</th><th className="px-4 py-3">Tầng</th><th className="px-4 py-3 text-right">Giá niêm yết / đêm</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Khách / Lịch kế tiếp</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{rooms.map((room) => <RoomRow key={room.id} onEdit={() => setEditing(room)} room={room} />)}</tbody>
            </table>
          </div>
        )}
      </Panel>
      )}
      {editing ? <RoomEditor room={editing === "new" ? undefined : editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); refresh(); }} /> : null}
      {managingTypes ? <RoomTypeManager onClose={() => setManagingTypes(false)} onSaved={refresh} /> : null}
    </>
  );
}

function ViewButton({ active, label, onClick }: Readonly<{ active: boolean; label: string; onClick: () => void }>) {
  return <button className={`min-h-10 whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${active ? "border-blue-200 bg-blue-50 text-blue-800" : "border-transparent text-slate-600 hover:bg-slate-50"}`} onClick={onClick} type="button">{label}</button>;
}

function RoomRow({ room, onEdit }: Readonly<{ room: RoomListItem; onEdit: () => void }>) {
  const actionHref = room.currentBookingId ? `/bookings?bookingId=${room.currentBookingId}` : `/bookings?roomId=${room.id}`;
  const actionLabel = room.status === "OCCUPIED" ? "Mở booking" : room.status === "RESERVED" ? "Check-in" : "Tạo đặt phòng";
  const actionStyle = room.status === "OCCUPIED" ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" : room.status === "RESERVED" ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 text-base font-semibold text-[var(--primary)]">{room.roomNumber}</td>
      <td className="px-4 py-3"><p className="font-medium text-slate-800">{room.roomTypeName}</p><p className="text-xs text-slate-500">{room.roomTypeCode}</p></td>
      <td className="px-4 py-3">{room.floorLabel ? `Tầng ${room.floorLabel}` : "—"}</td>
      <td className="px-4 py-3 text-right font-medium">{room.listedPricePerNight == null ? "Chưa xác nhận" : formatCurrency(room.listedPricePerNight)}</td>
      <td className="px-4 py-3"><span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${statusStyles[room.status]}`}>{statusLabels[room.status]}</span></td>
      <td className="px-4 py-3">{room.currentGuestName ? <><p className="font-medium">{room.currentGuestName}</p><p className="text-xs text-slate-500">{room.currentBookingCode}</p></> : <p className="text-slate-500">Kế tiếp: {formatDateTime(room.nextCheckInAt)}</p>}</td>
      <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2"><Button onClick={onEdit} variant="warning">Sửa</Button>{room.status !== "INACTIVE" && room.status !== "MAINTENANCE" ? <Link className={`inline-flex min-h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors ${actionStyle}`} href={actionHref}>{actionLabel}</Link> : null}</div></td>
    </tr>
  );
}
