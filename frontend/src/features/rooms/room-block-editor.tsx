"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { getApiErrorMessage, getApiProblem } from "@/lib/api-client";
import { createRoomBlock, getRoomBlock, updateRoomBlock } from "./rooms-api";
import type { RoomBlockWriteRequest, RoomListItem } from "./types";

function dateTime(date: string, hour: string) { return `${date}T${hour}`; }

export function RoomBlockEditor({ blockId, initialRoomId, initialDate, rooms, onClose, onSaved }: Readonly<{ blockId?: number; initialRoomId?: number; initialDate?: string; rooms: RoomListItem[]; onClose: () => void; onSaved: () => void }>) {
  const today = initialDate ?? new Date().toISOString().slice(0, 10);
  const nextDay = new Date(`${today}T00:00:00`); nextDay.setDate(nextDay.getDate() + 1);
  const [form, setForm] = useState<RoomBlockWriteRequest>({ roomId: initialRoomId ?? rooms.find((room) => room.isActive)?.id ?? 0, startAt: dateTime(today, "00:00"), endAt: dateTime(nextDay.toISOString().slice(0, 10), "00:00"), reason: "Bảo trì phòng", note: "", isActive: true, version: null });
  const [loading, setLoading] = useState(Boolean(blockId)); const [saving, setSaving] = useState(false); const [error, setError] = useState<string>(); const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => { if (!blockId) return; void getRoomBlock(blockId).then((item) => setForm({ roomId: item.roomId, startAt: item.startAt.slice(0, 16), endAt: item.endAt.slice(0, 16), reason: item.reason, note: item.note ?? "", isActive: item.isActive, version: item.version })).catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải lịch bảo trì."))).finally(() => setLoading(false)); }, [blockId]);
  async function save(nextActive = form.isActive) { setSaving(true); setError(undefined); setFieldErrors({}); try { const request = { ...form, isActive: nextActive }; if (blockId) await updateRoomBlock(blockId, request); else await createRoomBlock(request); onSaved(); } catch (reason) { setFieldErrors(getApiProblem(reason)?.errors ?? {}); setError(getApiErrorMessage(reason, "Không thể lưu lịch bảo trì.")); } finally { setSaving(false); } }

  return <div aria-labelledby="room-block-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-4" role="dialog"><form className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:max-h-[90dvh] sm:p-6" onSubmit={(e) => { e.preventDefault(); void save(); }}>
    <div className="flex items-start justify-between border-b border-slate-200 pb-4"><div><h2 className="text-lg font-semibold" id="room-block-title">{blockId ? "Cập nhật lịch bảo trì" : "Thêm lịch bảo trì"}</h2><p className="mt-1 text-sm text-slate-500">Phòng sẽ không xuất hiện trong danh sách phòng trống trong khoảng này.</p></div><Button onClick={onClose} variant="ghost">Đóng</Button></div>
    {error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    {loading ? <p className="py-10 text-center text-sm text-slate-500">Đang tải…</p> : <div className="mt-5 grid gap-4 md:grid-cols-2">
      <Field error={fieldErrors.roomId?.[0]} htmlFor="blockRoom" label="Phòng" required><Select disabled={Boolean(blockId)} id="blockRoom" onChange={(e) => setForm((x) => ({ ...x, roomId: Number(e.target.value) }))} value={form.roomId}><option value={0}>Chọn phòng</option>{rooms.filter((room) => room.isActive || room.id === form.roomId).map((room) => <option key={room.id} value={room.id}>{room.roomNumber} · {room.roomTypeName}</option>)}</Select></Field>
      <Field error={fieldErrors.reason?.[0]} htmlFor="blockReason" label="Lý do" required><Input id="blockReason" onChange={(e) => setForm((x) => ({ ...x, reason: e.target.value }))} value={form.reason} /></Field>
      <Field error={fieldErrors.startAt?.[0]} htmlFor="blockStart" label="Bắt đầu" required><Input id="blockStart" onChange={(e) => setForm((x) => ({ ...x, startAt: e.target.value }))} type="datetime-local" value={form.startAt} /></Field>
      <Field error={fieldErrors.endAt?.[0]} htmlFor="blockEnd" label="Kết thúc" required><Input id="blockEnd" onChange={(e) => setForm((x) => ({ ...x, endAt: e.target.value }))} type="datetime-local" value={form.endAt} /></Field>
      <div className="md:col-span-2"><Field error={fieldErrors.note?.[0]} htmlFor="blockNote" label="Ghi chú"><Textarea id="blockNote" onChange={(e) => setForm((x) => ({ ...x, note: e.target.value }))} value={form.note} /></Field></div>
    </div>}
    <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4"><div>{blockId && form.isActive ? <Button disabled={saving} onClick={() => void save(false)} variant="danger">Hủy lịch bảo trì</Button> : null}</div><div className="flex gap-2"><Button onClick={onClose} variant="secondary">Đóng</Button><Button disabled={loading || saving || !form.isActive} type="submit">{saving ? "Đang lưu…" : "Lưu lịch"}</Button></div></div>
  </form></div>;
}
