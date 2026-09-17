"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { getApiErrorMessage, getApiProblem } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { createRoom, getRoomTypes, updateRoom } from "./rooms-api";
import { RoomRateManager } from "./room-rate-manager";
import type { RoomListItem, RoomTypeItem, RoomWriteRequest } from "./types";

export function RoomEditor({ room, onClose, onSaved }: Readonly<{ room?: RoomListItem; onClose: () => void; onSaved: () => void }>) {
  const [roomTypes, setRoomTypes] = useState<RoomTypeItem[]>([]);
  const [form, setForm] = useState<RoomWriteRequest>({
    roomNumber: room?.roomNumber ?? "",
    roomTypeId: room?.roomTypeId ?? 0,
    floorLabel: room?.floorLabel ?? "",
    isActive: room?.isActive ?? true,
    countsTowardOccupancy: room?.countsTowardOccupancy ?? true,
    note: room?.note ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pricingRoomType, setPricingRoomType] = useState<RoomTypeItem>();

  useEffect(() => {
    void getRoomTypes().then((items) => {
      setRoomTypes(items);
      if (!form.roomTypeId) setForm((current) => ({ ...current, roomTypeId: items.find((item) => item.isActive)?.id ?? 0 }));
    }).catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải hạng phòng.")));
  }, [form.roomTypeId]);

  async function save() {
    setSaving(true); setError(undefined); setFieldErrors({});
    try {
      if (room) await updateRoom(room.id, form); else await createRoom(form);
      onSaved();
    } catch (reason) {
      setFieldErrors(getApiProblem(reason)?.errors ?? {});
      setError(getApiErrorMessage(reason, "Không thể lưu phòng."));
    } finally { setSaving(false); }
  }

  const selectedRoomType = roomTypes.find((item) => item.id === form.roomTypeId);

  return <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog">
    <form className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4"><div><h2 className="text-lg font-semibold">{room ? "Cập nhật phòng" : "Thêm phòng"}</h2><p className="mt-1 text-sm text-slate-500">Phòng đã phát sinh booking nên ngừng hoạt động thay vì xóa.</p></div><Button onClick={onClose} variant="ghost">Đóng</Button></div>
      {error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field error={fieldErrors.roomNumber?.[0]} htmlFor="roomNumber" label="Số phòng" required><Input autoFocus id="roomNumber" onChange={(e) => setForm((x) => ({ ...x, roomNumber: e.target.value }))} value={form.roomNumber} /></Field>
        <Field error={fieldErrors.roomTypeId?.[0]} htmlFor="roomTypeId" label="Hạng phòng" required><Select id="roomTypeId" onChange={(e) => setForm((x) => ({ ...x, roomTypeId: Number(e.target.value) }))} value={form.roomTypeId}><option value={0}>Chọn hạng phòng</option>{roomTypes.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}{item.isActive ? "" : " (ngừng dùng)"}</option>)}</Select></Field>
        {selectedRoomType ? <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2"><p className="text-sm text-slate-600">Giá mặc định <span className="ml-1 font-medium text-slate-900">{selectedRoomType.listedPricePerNight == null ? "Chưa thiết lập" : formatCurrency(selectedRoomType.listedPricePerNight)}</span></p><Button onClick={() => setPricingRoomType(selectedRoomType)} variant="info">Bảng giá</Button></div> : null}
        <Field error={fieldErrors.floorLabel?.[0]} htmlFor="floorLabel" label="Tầng"><Input id="floorLabel" onChange={(e) => setForm((x) => ({ ...x, floorLabel: e.target.value }))} value={form.floorLabel} /></Field>
        <Field htmlFor="roomActive" label="Trạng thái"><Select id="roomActive" onChange={(e) => setForm((x) => ({ ...x, isActive: e.target.value === "true" }))} value={String(form.isActive)}><option value="true">Đang hoạt động</option><option value="false">Ngừng hoạt động</option></Select></Field>
        <Field htmlFor="roomOccupancy" label="Tính vào công suất phòng"><Select id="roomOccupancy" onChange={(e) => setForm((x) => ({ ...x, countsTowardOccupancy: e.target.value === "true" }))} value={String(form.countsTowardOccupancy)}><option value="true">Có</option><option value="false">Không (phòng ảo/nội bộ)</option></Select></Field>
        <div className="md:col-span-2"><Field error={fieldErrors.note?.[0]} htmlFor="roomNote" label="Ghi chú"><Textarea id="roomNote" onChange={(e) => setForm((x) => ({ ...x, note: e.target.value }))} value={form.note} /></Field></div>
      </div>
      {room?.bookingCount ? <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Phòng đã có {room.bookingCount} booking trong lịch sử.</p> : null}
      <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4"><Button onClick={onClose} variant="secondary">Hủy</Button><Button disabled={saving} type="submit">{saving ? "Đang lưu…" : "Lưu phòng"}</Button></div>
    </form>
    {pricingRoomType ? <RoomRateManager onClose={() => setPricingRoomType(undefined)} roomType={pricingRoomType} /> : null}
  </div>;
}
