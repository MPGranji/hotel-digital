"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { getApiErrorMessage, getApiProblem } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { RoomRateManager } from "./room-rate-manager";
import { createRoomType, getRoomTypes, updateRoomType } from "./rooms-api";
import type { RoomTypeItem, RoomTypeWriteRequest } from "./types";

const empty: RoomTypeWriteRequest = { code: "", name: "", capacity: 1, listedPricePerNight: undefined, isActive: true };

export function RoomTypeManager({ onClose, onSaved }: Readonly<{ onClose: () => void; onSaved: () => void }>) {
  const [items, setItems] = useState<RoomTypeItem[]>([]);
  const [editing, setEditing] = useState<RoomTypeItem>();
  const [pricing, setPricing] = useState<RoomTypeItem>();
  const [form, setForm] = useState<RoomTypeWriteRequest>(empty);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  function load() { void getRoomTypes().then(setItems).catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải hạng phòng."))); }
  useEffect(load, []);
  function edit(item?: RoomTypeItem) { setEditing(item); setFieldErrors({}); setError(undefined); setForm(item ? { code: item.code, name: item.name, capacity: item.capacity, listedPricePerNight: item.listedPricePerNight, isActive: item.isActive } : empty); }
  async function save() {
    setSaving(true); setError(undefined); setFieldErrors({});
    try { if (editing) await updateRoomType(editing.id, form); else await createRoomType(form); edit(); load(); onSaved(); }
    catch (reason) { setFieldErrors(getApiProblem(reason)?.errors ?? {}); setError(getApiErrorMessage(reason, "Không thể lưu hạng phòng.")); }
    finally { setSaving(false); }
  }

  return <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog"><div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
    <div className="flex items-start justify-between border-b border-slate-200 pb-4"><div><h2 className="text-lg font-semibold">Quản lý hạng phòng</h2><p className="mt-1 text-sm text-slate-500">Giá mặc định dùng khi chưa có bảng giá theo kênh và thời gian.</p></div><Button onClick={onClose} variant="ghost">Đóng</Button></div>
    {error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    <form className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <Field error={fieldErrors.code?.[0]} htmlFor="typeCode" label="Mã" required><Input id="typeCode" onChange={(e) => setForm((x) => ({ ...x, code: e.target.value }))} value={form.code} /></Field>
      <Field error={fieldErrors.name?.[0]} htmlFor="typeName" label="Tên" required><Input id="typeName" onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))} value={form.name} /></Field>
      <Field error={fieldErrors.capacity?.[0]} htmlFor="typeCapacity" label="Tối đa"><Input id="typeCapacity" min={1} onChange={(e) => setForm((x) => ({ ...x, capacity: Number(e.target.value) }))} type="number" value={form.capacity} /></Field>
      <Field error={fieldErrors.listedPricePerNight?.[0]} htmlFor="typePrice" label="Giá mặc định / đêm"><Input id="typePrice" min={0} onChange={(e) => setForm((x) => ({ ...x, listedPricePerNight: e.target.value ? Number(e.target.value) : undefined }))} type="number" value={form.listedPricePerNight ?? ""} /></Field>
      <Field htmlFor="typeActive" label="Trạng thái"><Select id="typeActive" onChange={(e) => setForm((x) => ({ ...x, isActive: e.target.value === "true" }))} value={String(form.isActive)}><option value="true">Hoạt động</option><option value="false">Ngừng dùng</option></Select></Field>
      <div className="flex gap-2 md:col-span-5 md:justify-end"><Button onClick={() => edit()} variant="secondary">Mới</Button><Button disabled={saving} type="submit">{saving ? "Đang lưu…" : editing ? "Cập nhật" : "Thêm hạng"}</Button></div>
    </form>
    <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Mã / Tên</th><th className="px-4 py-3">Sức chứa</th><th className="px-4 py-3 text-right">Giá mặc định</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Phòng</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="px-4 py-3"><b>{item.code}</b><p className="text-xs text-slate-500">{item.name}</p></td><td className="px-4 py-3">{item.capacity} người</td><td className="px-4 py-3 text-right">{item.listedPricePerNight == null ? "—" : formatCurrency(item.listedPricePerNight)}</td><td className="px-4 py-3">{item.isActive ? "Hoạt động" : "Ngừng dùng"}</td><td className="px-4 py-3 text-right">{item.roomCount}</td><td className="px-4 py-3 text-right"><div className="flex justify-end gap-2"><Button onClick={() => setPricing(item)} variant="info">Bảng giá</Button><Button onClick={() => edit(item)} variant="warning">Sửa</Button></div></td></tr>)}</tbody></table></div>
  </div>{pricing ? <RoomRateManager onClose={() => setPricing(undefined)} roomType={pricing} /> : null}</div>;
}
