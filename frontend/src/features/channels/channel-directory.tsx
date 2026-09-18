"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataMessage, PageHeader, Panel } from "@/components/ui/page";
import { getApiErrorMessage } from "@/lib/api-client";
import { ChannelEditor } from "./channel-editor";
import { getChannels, updateChannel } from "./channels-api";
import type { ChannelItem } from "./types";

const categoryLabels = { DIRECT: "Trực tiếp", OTA: "OTA", PARTNER: "Đối tác", INTERNAL: "Nội bộ", UNKNOWN: "Chưa xác định" };

export function ChannelDirectory() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [active, setActive] = useState("");
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<ChannelItem | "new">();
  const [updatingId, setUpdatingId] = useState<number>();

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let mounted = true;
    void getChannels(search, category, active)
      .then((data) => { if (mounted) setChannels(data); })
      .catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải danh sách kênh.")))
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, [active, category, reloadKey, search]);

  function refresh() {
    setLoading(true);
    setError(undefined);
    setReloadKey((value) => value + 1);
  }

  async function toggleChannel(channel: ChannelItem) {
    const action = channel.isActive ? "ngừng sử dụng" : "kích hoạt lại";
    if (!window.confirm(`Xác nhận ${action} kênh ${channel.name}? Booking lịch sử vẫn được giữ nguyên.`)) return;
    setUpdatingId(channel.id);
    setError(undefined);
    try {
      await updateChannel(channel.id, {
        code: channel.code,
        name: channel.name,
        category: channel.category,
        isActive: !channel.isActive,
        note: channel.note ?? "",
      });
      refresh();
    } catch (reason) {
      setError(getApiErrorMessage(reason, `Không thể ${action} kênh.`));
    } finally {
      setUpdatingId(undefined);
    }
  }

  return (
    <>
      <PageHeader actions={<Button onClick={() => setEditing("new")}>Thêm kênh</Button>} description="Quản lý nguồn đặt phòng trực tiếp, OTA, đối tác và nội bộ. Kênh đã dùng được ngừng hoạt động thay vì xóa." title="Kênh đặt phòng" />
      <Panel>
        <div className="mb-5 grid gap-3 border-b border-slate-200 pb-5 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px_220px_auto]">
          <Input aria-label="Tìm kênh" onChange={(event) => { setQuery(event.target.value); setLoading(true); }} placeholder="Tìm tên hoặc mã kênh" value={query} />
          <Select aria-label="Nhóm kênh" onChange={(event) => { setCategory(event.target.value); setLoading(true); }} value={category}><option value="">Tất cả nhóm</option><option value="DIRECT">Trực tiếp</option><option value="OTA">OTA</option><option value="PARTNER">Đối tác</option><option value="INTERNAL">Nội bộ</option><option value="UNKNOWN">Chưa xác định</option></Select>
          <Select aria-label="Trạng thái kênh" onChange={(event) => { setActive(event.target.value); setLoading(true); }} value={active}><option value="">Tất cả trạng thái</option><option value="true">Đang hoạt động</option><option value="false">Ngừng hoạt động</option></Select>
          <Button onClick={refresh} variant="secondary">Làm mới</Button>
        </div>
        {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Không thể tải dữ liệu" /> : loading ? <DataMessage title="Đang tải danh sách kênh…" /> : channels.length === 0 ? <DataMessage description="Thử thay đổi bộ lọc hoặc thêm kênh mới." title="Không có kênh phù hợp" /> : (
          <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Mã kênh</th><th className="px-4 py-3">Tên kênh</th><th className="px-4 py-3">Nhóm</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Booking</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{channels.map((channel) => <tr className="hover:bg-slate-50" key={channel.id}><td className="px-4 py-3 font-medium text-[var(--primary)]">{channel.code}</td><td className="px-4 py-3"><p className="font-medium">{channel.name}</p>{channel.note ? <p className="max-w-md truncate text-xs text-slate-500">{channel.note}</p> : null}</td><td className="px-4 py-3"><span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{categoryLabels[channel.category]}</span></td><td className="px-4 py-3"><span className={`rounded-md border px-2 py-1 text-xs font-medium ${channel.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>{channel.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}</span></td><td className="px-4 py-3 text-right">{channel.bookingCount}</td><td className="px-4 py-3 text-right"><div className="flex justify-end gap-2"><Button onClick={() => setEditing(channel)} variant="warning">Sửa</Button><Button disabled={updatingId === channel.id} onClick={() => void toggleChannel(channel)} variant={channel.isActive ? "danger" : "secondary"}>{updatingId === channel.id ? "Đang lưu…" : channel.isActive ? "Ngừng dùng" : "Kích hoạt"}</Button></div></td></tr>)}</tbody></table></div>
        )}
      </Panel>
      {editing ? <ChannelEditor channel={editing === "new" ? undefined : editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); refresh(); }} /> : null}
    </>
  );
}
