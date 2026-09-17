"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { getApiErrorMessage, getApiProblem } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/format";
import { createRoomRate, getRoomRateHistory, getRoomRates, updateRoomRate } from "./rooms-api";
import type { RoomRateHistoryItem, RoomRateItem, RoomRateWriteRequest, RoomTypeItem } from "./types";

const dayFields = [
  { label: "T2", key: "mondayPrice" },
  { label: "T3", key: "tuesdayPrice" },
  { label: "T4", key: "wednesdayPrice" },
  { label: "T5", key: "thursdayPrice" },
  { label: "T6", key: "fridayPrice" },
  { label: "T7", key: "saturdayPrice" },
  { label: "CN", key: "sundayPrice" },
] as const;

const compactMoneyFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function emptyForm(roomType: RoomTypeItem): RoomRateWriteRequest {
  const basePrice = roomType.listedPricePerNight ?? 0;
  return {
    roomTypeId: roomType.id,
    effectiveFrom: localDate(),
    effectiveTo: undefined,
    mondayPrice: basePrice,
    tuesdayPrice: basePrice,
    wednesdayPrice: basePrice,
    thursdayPrice: basePrice,
    fridayPrice: basePrice,
    saturdayPrice: basePrice,
    sundayPrice: basePrice,
    isActive: true,
    note: "",
    version: null,
  };
}

export function RoomRateManager({ roomType, onClose }: Readonly<{ roomType: RoomTypeItem; onClose: () => void }>) {
  const [items, setItems] = useState<RoomRateItem[]>([]);
  const [editing, setEditing] = useState<RoomRateItem>();
  const [form, setForm] = useState<RoomRateWriteRequest>(() => emptyForm(roomType));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyFor, setHistoryFor] = useState<RoomRateItem>();
  const [history, setHistory] = useState<RoomRateHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function load() {
    setLoading(true);
    void getRoomRates(roomType.id)
      .then(setItems)
      .catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải bảng giá.")))
      .finally(() => setLoading(false));
  }

  function showHistory(item: RoomRateItem) {
    if (historyFor?.id === item.id) {
      setHistoryFor(undefined);
      setHistory([]);
      return;
    }

    setHistoryFor(item);
    setHistory([]);
    setHistoryLoading(true);
    setError(undefined);
    void getRoomRateHistory(item.id)
      .then(setHistory)
      .catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải lịch sử bảng giá.")))
      .finally(() => setHistoryLoading(false));
  }

  useEffect(() => {
    let active = true;
    void getRoomRates(roomType.id)
      .then((result) => { if (active) setItems(result); })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, "Không thể tải bảng giá.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [roomType.id]);

  function edit(item?: RoomRateItem) {
    setEditing(item);
    setError(undefined);
    setFieldErrors({});
    setForm(item ? {
      roomTypeId: item.roomTypeId,
      effectiveFrom: item.effectiveFrom,
      effectiveTo: item.effectiveTo,
      mondayPrice: item.mondayPrice,
      tuesdayPrice: item.tuesdayPrice,
      wednesdayPrice: item.wednesdayPrice,
      thursdayPrice: item.thursdayPrice,
      fridayPrice: item.fridayPrice,
      saturdayPrice: item.saturdayPrice,
      sundayPrice: item.sundayPrice,
      isActive: item.isActive,
      note: item.note ?? "",
      version: item.version,
    } : emptyForm(roomType));
  }

  async function save() {
    setSaving(true);
    setError(undefined);
    setFieldErrors({});
    try {
      if (editing) await updateRoomRate(editing.id, form);
      else await createRoomRate(form);
      edit();
      load();
    } catch (reason) {
      setFieldErrors(getApiProblem(reason)?.errors ?? {});
      setError(getApiErrorMessage(reason, "Không thể lưu bảng giá."));
    } finally {
      setSaving(false);
    }
  }

  return <div aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4" role="dialog">
    <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div><h2 className="text-lg font-semibold">Giá tại quầy · {roomType.name}</h2><p className="mt-1 text-sm text-slate-500">Thiết lập theo thời gian và từng ngày trong tuần. Mức giá mới sẽ tự đóng mức giá đang áp dụng.</p></div>
        <Button onClick={onClose} variant="ghost">Đóng</Button>
      </div>

      {error ? <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <form className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="grid gap-3 md:grid-cols-3">
          <Field error={fieldErrors.effectiveFrom?.[0]} htmlFor="rateFrom" label="Từ ngày" required><Input id="rateFrom" onChange={(event) => setForm((value) => ({ ...value, effectiveFrom: event.target.value }))} type="date" value={form.effectiveFrom} /></Field>
          <Field error={fieldErrors.effectiveTo?.[0]} htmlFor="rateTo" label="Đến ngày"><Input id="rateTo" min={form.effectiveFrom} onChange={(event) => setForm((value) => ({ ...value, effectiveTo: event.target.value || undefined }))} type="date" value={form.effectiveTo ?? ""} /></Field>
          <Field htmlFor="rateActive" label="Trạng thái"><Select id="rateActive" onChange={(event) => setForm((value) => ({ ...value, isActive: event.target.value === "true" }))} value={String(form.isActive)}><option value="true">Đang áp dụng</option><option value="false">Ngừng áp dụng</option></Select></Field>
        </div>
        <div className="mt-4 overflow-x-auto pb-1"><div className="grid min-w-[840px] grid-cols-7 gap-2">{dayFields.map((day) => <Field error={fieldErrors[day.key]?.[0]} htmlFor={`rate-${day.key}`} key={day.key} label={day.label} required><MoneyInput id={`rate-${day.key}`} onChange={(value) => setForm((current) => ({ ...current, [day.key]: Number(value || 0) }))} value={String(form[day.key] || "")} /></Field>)}</div></div>
        <div className="mt-4 flex justify-end gap-2"><Button onClick={() => edit()} variant="secondary">Mức giá mới</Button><Button disabled={saving} type="submit">{saving ? "Đang lưu…" : editing ? "Cập nhật" : "Thêm mức giá"}</Button></div>
      </form>

      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Hiệu lực</th><th className="px-4 py-3">Giá tại quầy · T2 đến CN</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{loading ? <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={4}>Đang tải bảng giá…</td></tr> : items.length === 0 ? <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={4}>Chưa có mức giá nâng cao.</td></tr> : items.map((item) => <tr className={item.isActive ? "" : "bg-slate-50 text-slate-500"} key={item.id}>
            <td className="px-4 py-3"><p className="font-medium text-slate-900">{formatDate(item.effectiveFrom)}</p><p className="text-xs text-slate-500">đến {item.effectiveTo ? formatDate(item.effectiveTo) : "khi có giá mới"}</p><p className="mt-1 text-[11px] text-slate-400">Sửa {formatDateTime(item.lastModifiedAtUtc)}{item.lastModifiedByDisplayName ? ` · ${item.lastModifiedByDisplayName}` : ""}</p></td>
            <td className="px-4 py-3"><div className="grid min-w-[560px] grid-cols-7 gap-1">{dayFields.map((day) => <div className="rounded-md bg-slate-50 px-2 py-1.5 text-center" key={day.key}><span className="block text-[10px] text-slate-500">{day.label}</span><span className="text-xs font-medium tabular-nums">{compactMoneyFormatter.format(item[day.key])}</span></div>)}</div></td>
            <td className="px-4 py-3"><span className={`rounded-md border px-2 py-1 text-xs font-medium ${item.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>{item.isActive ? "Đang áp dụng" : "Ngừng áp dụng"}</span></td>
            <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2"><Button onClick={() => showHistory(item)} variant="secondary">{historyFor?.id === item.id ? "Ẩn lịch sử" : "Lịch sử"}</Button><Button onClick={() => edit(item)} variant="warning">Sửa</Button></div></td>
          </tr>)}</tbody>
        </table>
      </div>

      {historyFor ? <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-slate-900">Lịch sử thay đổi</h3><p className="mt-1 text-xs text-slate-500">Mức giá từ {formatDate(historyFor.effectiveFrom)}. Thời gian ghi nhận dùng múi giờ hệ thống khi hiển thị.</p></div><Button onClick={() => showHistory(historyFor)} variant="ghost">Đóng</Button></div>
        {historyLoading ? <p className="py-6 text-center text-sm text-slate-500">Đang tải lịch sử…</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-2">Ghi nhận</th><th className="pb-2">Hiệu lực</th><th className="pb-2">Giá T2 đến CN</th><th className="pb-2">Người sửa</th><th className="pb-2">Phiên bản</th></tr></thead><tbody className="divide-y divide-slate-200">{history.map((item) => <tr key={`${item.id}-${item.recordedFromUtc}`}><td className="py-3 pr-4">{formatDateTime(item.recordedFromUtc)}</td><td className="py-3 pr-4">{formatDate(item.effectiveFrom)} – {item.effectiveTo ? formatDate(item.effectiveTo) : "không giới hạn"}</td><td className="py-3 pr-4"><div className="grid min-w-[490px] grid-cols-7 gap-1">{dayFields.map((day) => <span className="rounded bg-white px-1.5 py-1 text-center text-xs tabular-nums" key={day.key}>{compactMoneyFormatter.format(item[day.key])}</span>)}</div></td><td className="py-3 pr-4">{item.lastModifiedByDisplayName ?? "Dữ liệu cũ"}</td><td className="py-3"><span className={`rounded-md border px-2 py-1 text-xs ${item.isCurrent ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}>{item.isCurrent ? "Hiện tại" : "Đã thay thế"}</span></td></tr>)}</tbody></table></div>}
      </section> : null}
    </div>
  </div>;
}
