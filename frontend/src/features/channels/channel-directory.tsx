"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataMessage, PageHeader, Panel } from "@/components/ui/page";
import { getApiErrorMessage } from "@/lib/api-client";
import { useLiveRevision } from "@/features/realtime/live-updates-provider";
import { ChannelEditor } from "./channel-editor";
import { getChannels, updateChannel } from "./channels-api";
import type { ChannelCategory, ChannelItem } from "./types";

const categoryLabels: Record<ChannelCategory, string> = {
  OFFLINE: "Trực tiếp",
  ONLINE: "Online",
  TRAVEL_AGENCY: "Đại lý du lịch",
};

function getCategoryLabel(category: string) {
  return categoryLabels[category as ChannelCategory] ?? category;
}

export function ChannelDirectory() {
  const liveRevision = useLiveRevision();
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
      .then((data) => { if (mounted) { setChannels(data); setError(undefined); } })
      .catch((reason) => { if (mounted) setError(getApiErrorMessage(reason, "Không thể tải danh sách kênh.")); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [active, category, reloadKey, search, liveRevision]);

  function refresh() {
    setLoading(true);
    setError(undefined);
    setReloadKey((value) => value + 1);
  }

  async function toggleChannel(channel: ChannelItem) {
    const action = channel.isActive ? "ngừng sử dụng" : "kích hoạt lại";
    if (!window.confirm(`Xác nhận ${action} kênh ${channel.name}? Các đặt phòng cũ vẫn được giữ nguyên.`)) return;
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
      <PageHeader actions={<Button onClick={() => setEditing("new")}>Thêm kênh</Button>} description="Quản lý nơi khách đặt phòng: trực tiếp, online hoặc qua đại lý." title="Kênh đặt phòng" />
      <Panel>
        <div className="mb-5 grid gap-3 border-b border-slate-200 pb-5 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px_220px_auto]">
          <Input aria-label="Tìm kênh" onChange={(event) => { setQuery(event.target.value); setLoading(true); }} placeholder="Tìm tên hoặc mã kênh" value={query} />
          <Select aria-label="Nhóm kênh" onChange={(event) => { setCategory(event.target.value); setLoading(true); }} value={category}><option value="">Tất cả nhóm</option><option value="OFFLINE">Trực tiếp</option><option value="ONLINE">Online</option><option value="TRAVEL_AGENCY">Đại lý du lịch</option></Select>
          <Select aria-label="Trạng thái kênh" onChange={(event) => { setActive(event.target.value); setLoading(true); }} value={active}><option value="">Tất cả trạng thái</option><option value="true">Đang hoạt động</option><option value="false">Ngừng hoạt động</option></Select>
          <Button onClick={refresh} variant="secondary">Làm mới</Button>
        </div>
        {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Không thể tải dữ liệu" /> : loading ? <DataMessage title="Đang tải danh sách kênh…" /> : channels.length === 0 ? <DataMessage description="Thử thay đổi bộ lọc hoặc thêm kênh mới." title="Không có kênh phù hợp" /> : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[var(--sidebar)] text-xs text-[var(--muted)]">
                <tr><th className="px-4 py-3">Mã kênh</th><th className="px-4 py-3">Tên kênh</th><th className="px-4 py-3">Nhóm</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Lượt đặt</th><th className="px-4 py-3 text-right">Thao tác</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {channels.map((channel) => <tr className="hover:bg-[var(--sidebar)]" key={channel.id}>
                  <td className="px-4 py-3 font-medium text-[var(--primary)]">{channel.code}</td>
                  <td className="px-4 py-3"><p className="font-medium">{channel.name}</p>{channel.note ? <p className="max-w-md truncate text-xs text-[var(--muted)]">{channel.note}</p> : null}</td>
                  <td className="px-4 py-3"><span className="rounded-md border border-[#bdd1cb] bg-[var(--nav-active)] px-2 py-1 text-xs font-medium text-[var(--primary-strong)]">{getCategoryLabel(channel.category)}</span></td>
                  <td className="px-4 py-3"><span className={`rounded-md border px-2 py-1 text-xs font-medium ${channel.isActive ? "border-[#bdd1cb] bg-[#edf5f2] text-[#24544d]" : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--nav-text)]"}`}>{channel.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}</span></td>
                  <td className="px-4 py-3 text-right">{channel.bookingCount}</td>
                  <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1"><Button onClick={() => setEditing(channel)} size="sm" variant="secondary">Sửa</Button><Button disabled={updatingId === channel.id} onClick={() => void toggleChannel(channel)} size="sm" variant={channel.isActive ? "danger" : "secondary"}>{updatingId === channel.id ? "Đang lưu…" : channel.isActive ? "Ngừng dùng" : "Kích hoạt"}</Button></div></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {editing ? <ChannelEditor channel={editing === "new" ? undefined : editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); refresh(); }} /> : null}
    </>
  );
}
