"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { getApiErrorMessage, getApiProblem } from "@/lib/api-client";
import { createChannel, updateChannel } from "./channels-api";
import type { ChannelCategory, ChannelItem, ChannelWriteRequest } from "./types";

export function ChannelEditor({ channel, onClose, onSaved }: Readonly<{ channel?: ChannelItem; onClose: () => void; onSaved: () => void }>) {
  const [form, setForm] = useState<ChannelWriteRequest>({
    code: channel?.code ?? "",
    name: channel?.name ?? "",
    category: channel?.category ?? "OFFLINE",
    isActive: channel?.isActive ?? true,
    note: channel?.note ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function save() {
    setSaving(true);
    setError(undefined);
    setFieldErrors({});
    try {
      if (channel) await updateChannel(channel.id, form);
      else await createChannel(form);
      onSaved();
    } catch (reason) {
      setFieldErrors(getApiProblem(reason)?.errors ?? {});
      setError(getApiErrorMessage(reason, "Không thể lưu kênh đặt phòng."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div aria-labelledby="channel-editor-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog">
      <form className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4"><div><h2 className="text-lg font-semibold text-slate-950" id="channel-editor-title">{channel ? "Cập nhật kênh" : "Thêm kênh đặt phòng"}</h2><p className="mt-1 text-sm text-slate-500">Hoa hồng không thuộc luồng vận hành hiện tại.</p></div><Button onClick={onClose} variant="ghost">Đóng</Button></div>
        {error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p> : null}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field error={fieldErrors.code?.[0]} htmlFor="channelCode" label="Mã kênh" required><Input autoFocus id="channelCode" onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} value={form.code} /></Field>
          <Field error={fieldErrors.name?.[0]} htmlFor="channelName" label="Tên kênh" required><Input id="channelName" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} value={form.name} /></Field>
          <Field error={fieldErrors.category?.[0]} htmlFor="channelCategory" label="Nhóm kênh" required><Select id="channelCategory" onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as ChannelCategory }))} value={form.category}><option value="OFFLINE">Offline</option><option value="ONLINE">Online</option><option value="TRAVEL_AGENCY">Đại lý du lịch</option></Select></Field>
          <Field htmlFor="channelActive" label="Trạng thái"><Select id="channelActive" onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === "true" }))} value={String(form.isActive)}><option value="true">Đang hoạt động</option><option value="false">Ngừng hoạt động</option></Select></Field>
          <div className="md:col-span-2"><Field error={fieldErrors.note?.[0]} htmlFor="channelNote" label="Ghi chú"><Textarea id="channelNote" onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} value={form.note} /></Field></div>
        </div>
        {channel?.bookingCount ? <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Kênh đã có {channel.bookingCount} booking. Khi không còn sử dụng, hãy chuyển sang ngừng hoạt động để giữ lịch sử.</p> : null}
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4"><Button onClick={onClose} variant="secondary">Hủy</Button><Button disabled={saving} type="submit">{saving ? "Đang lưu…" : "Lưu kênh"}</Button></div>
      </form>
    </div>
  );
}
