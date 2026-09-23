"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataMessage, PageHeader, Panel } from "@/components/ui/page";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { RoomEditor } from "./room-editor";
import { RoomMaintenance } from "./room-maintenance";
import { RoomTypeManager } from "./room-type-manager";
import { getRooms, updateRoom } from "./rooms-api";
import type { RoomListItem } from "./types";

const statusLabels = {
  AVAILABLE: "Trống",
  RESERVED: "Đã đặt",
  OCCUPIED: "Đang có khách",
  HELD: "Giữ đến giờ đi",
  MAINTENANCE: "Bảo trì",
  INACTIVE: "Ngừng hoạt động",
};

const statusStyles = {
  AVAILABLE: "border-[#bdd1cb] bg-[#edf5f2] text-[#24544d]",
  RESERVED: "border-[#d8c6a7] bg-[#faf4e9] text-[#755b2e]",
  OCCUPIED: "border-[#bbd0bd] bg-[#edf4ed] text-[#365c42]",
  HELD: "border-[#c9d2dd] bg-[#eef1f5] text-[#4e6075]",
  MAINTENANCE: "border-[#dfc0b9] bg-[#f9efec] text-[#8c493e]",
  INACTIVE: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--nav-text)]",
};

export function RoomDirectory() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<{ key: string; rooms?: RoomListItem[]; error?: string }>();
  const [actionError, setActionError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<RoomListItem | "new">();
  const [updatingId, setUpdatingId] = useState<number>();
  const [managingTypes, setManagingTypes] = useState(false);
  const [view, setView] = useState<"list" | "maintenance">("list");
  const requestKey = `${search}|${status}|${reloadKey}`;
  const current = result?.key === requestKey ? result : undefined;
  const rooms = current?.rooms ?? [];
  const error = query.trim() === search ? current?.error : undefined;
  const loading = query.trim() !== search || !current;

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    void getRooms(search, status)
      .then((data) => { if (active) setResult({ key: requestKey, rooms: data }); })
      .catch((reason) => { if (active) setResult({ key: requestKey, error: getApiErrorMessage(reason, "Không thể tải danh sách phòng.") }); });
    return () => { active = false; };
  }, [requestKey, search, status]);

  function refresh() {
    setActionError(undefined);
    setReloadKey((value) => value + 1);
  }

  async function toggleRoom(room: RoomListItem) {
    const action = room.isActive ? "ngừng sử dụng" : "kích hoạt lại";
    if (!window.confirm(`Xác nhận ${action} phòng ${room.roomNumber}?`)) return;
    setUpdatingId(room.id);
    setActionError(undefined);
    try {
      await updateRoom(room.id, {
        roomNumber: room.roomNumber,
        roomTypeId: room.roomTypeId,
        floorLabel: room.floorLabel ?? "",
        isActive: !room.isActive,
        countsTowardOccupancy: room.countsTowardOccupancy,
        note: room.note ?? "",
      });
      refresh();
    } catch (reason) {
      setActionError(getApiErrorMessage(reason, `Không thể ${action} phòng.`));
    } finally {
      setUpdatingId(undefined);
    }
  }

  return (
    <>
      <PageHeader actions={<><Button onClick={() => setManagingTypes(true)} variant="secondary">Hạng phòng</Button><Button onClick={() => setEditing("new")}>Thêm phòng</Button></>} description="Quản lý danh sách phòng, hạng phòng và lịch bảo trì." title="Phòng" />
      <nav aria-label="Chế độ quản lý phòng" className="mb-5 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
        <ViewButton active={view === "list"} label="Danh sách phòng" onClick={() => setView("list")} />
        <ViewButton active={view === "maintenance"} label="Lịch bảo trì" onClick={() => setView("maintenance")} />
      </nav>
      {view === "maintenance" ? <RoomMaintenance rooms={rooms} /> : (
      <Panel>
        <div className="mb-5 flex flex-col gap-3 border-b border-[var(--border)] pb-5 md:flex-row md:items-center">
          <Input aria-label="Tìm phòng" className="md:max-w-sm" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm số phòng, hạng phòng hoặc tầng" value={query} />
          <Select aria-label="Trạng thái phòng" className="md:max-w-xs" onChange={(event) => setStatus(event.target.value)} value={status}><option value="">Tất cả trạng thái</option><option value="AVAILABLE">Trống</option><option value="RESERVED">Đã đặt</option><option value="OCCUPIED">Đang có khách</option><option value="HELD">Giữ đến giờ đi</option><option value="MAINTENANCE">Bảo trì</option><option value="INACTIVE">Ngừng hoạt động</option></Select>
          <Button className="md:ml-auto" onClick={refresh} variant="secondary">Làm mới</Button>
        </div>
        {actionError ? <p className="mb-4 rounded-lg border border-[#dfc0b9] bg-[#f9efec] px-4 py-3 text-sm text-[#8c493e]" role="alert">{actionError}</p> : null}
        {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Không thể tải dữ liệu" /> : loading ? <DataMessage title="Đang tải danh sách phòng…" /> : rooms.length === 0 ? <DataMessage description="Thử thay đổi từ khóa hoặc trạng thái." title="Không có phòng phù hợp" /> : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[var(--sidebar)] text-xs text-[var(--muted)]"><tr><th className="px-4 py-3">Phòng</th><th className="px-4 py-3">Hạng phòng</th><th className="px-4 py-3">Tầng</th><th className="px-4 py-3 text-right">Giá / đêm</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Khách / Lịch kế tiếp</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{rooms.map((room) => <RoomRow key={room.id} onEdit={() => setEditing(room)} onToggle={() => void toggleRoom(room)} room={room} updating={updatingId === room.id} />)}</tbody>
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
  return <button aria-pressed={active} className={`min-h-10 whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${active ? "border-[#bdd1cb] bg-[var(--nav-active)] text-[var(--primary-strong)]" : "border-transparent text-[var(--muted)] hover:bg-[var(--surface-muted)]"}`} onClick={onClick} type="button">{label}</button>;
}

function RoomRow({ room, onEdit, onToggle, updating }: Readonly<{ room: RoomListItem; onEdit: () => void; onToggle: () => void; updating: boolean }>) {
  const actionHref = room.currentBookingId ? `/bookings?bookingId=${room.currentBookingId}` : `/bookings?roomId=${room.id}`;
  const actionLabel = room.status === "OCCUPIED" || room.status === "HELD" ? "Xem đặt phòng" : room.status === "RESERVED" ? "Nhận phòng" : "Tạo đặt phòng";
  const actionStyle = room.status === "OCCUPIED" ? "border-[#bbd0bd] bg-[#edf4ed] text-[#365c42] hover:bg-[#e2eee2]" : room.status === "HELD" ? "border-[#c9d2dd] bg-[#eef1f5] text-[#4e6075] hover:bg-[#e5eaf0]" : room.status === "RESERVED" ? "border-[#d8c6a7] bg-[#faf4e9] text-[#755b2e] hover:bg-[#f3ead8]" : "border-[#bdd1cb] bg-[#edf5f2] text-[#24544d] hover:bg-[#e1eee9]";
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 text-base font-semibold text-[var(--primary)]">{room.roomNumber}</td>
      <td className="px-4 py-3"><p className="font-medium text-slate-800">{room.roomTypeName}</p><p className="text-xs text-slate-500">{room.roomTypeCode}</p></td>
      <td className="px-4 py-3">{room.floorLabel ? `Tầng ${room.floorLabel}` : "—"}</td>
      <td className="px-4 py-3 text-right font-medium">{room.listedPricePerNight == null ? "Chưa xác nhận" : formatCurrency(room.listedPricePerNight)}</td>
      <td className="px-4 py-3"><span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${statusStyles[room.status]}`}>{statusLabels[room.status]}</span></td>
      <td className="px-4 py-3">{room.currentGuestName ? <><p className="font-medium">{room.status === "HELD" ? "Khách đã trả: " : ""}{room.currentGuestName}</p><p className="text-xs text-slate-500">{room.currentBookingCode} · {room.status === "HELD" ? `Giữ đến ${formatDateTime(room.currentCheckOutAt)}` : `${formatDateTime(room.currentCheckInAt)} → ${formatDateTime(room.currentCheckOutAt)}`}</p></> : room.nextCheckInAt ? <><p className="text-slate-700">Đặt phòng kế tiếp</p><p className="text-xs text-slate-500">{formatDateTime(room.nextCheckInAt)} → {formatDateTime(room.nextCheckOutAt)}</p></> : <p className="text-slate-500">Chưa có lịch kế tiếp</p>}</td>
      <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1"><Button onClick={onEdit} size="sm" variant="secondary">Sửa</Button><Button disabled={updating || room.status === "OCCUPIED" || room.status === "RESERVED" || room.status === "HELD"} onClick={onToggle} size="sm" variant={room.isActive ? "danger" : "secondary"}>{updating ? "Đang lưu…" : room.isActive ? "Ngừng dùng" : "Kích hoạt"}</Button>{room.status !== "INACTIVE" && room.status !== "MAINTENANCE" ? <Link className={`inline-flex min-h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors ${actionStyle}`} href={actionHref}>{actionLabel}</Link> : null}</div></td>
    </tr>
  );
}
