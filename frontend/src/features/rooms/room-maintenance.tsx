"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { DataMessage } from "@/components/ui/page";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { RoomBlockEditor } from "./room-block-editor";
import { getRoomCalendar } from "./rooms-api";
import type { RoomCalendarResponse, RoomListItem } from "./types";

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

interface MaintenanceRow {
  id: number;
  roomId: number;
  roomNumber: string;
  roomTypeName: string;
  reason: string;
  firstDate: string;
  lastDate: string;
}

export function RoomMaintenance({ rooms }: Readonly<{ rooms: RoomListItem[] }>) {
  const [dateFrom, setDateFrom] = useState(localDate());
  const [data, setData] = useState<RoomCalendarResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<{ blockId?: number }>();

  useEffect(() => {
    let active = true;
    void getRoomCalendar(dateFrom, 31)
      .then((result) => { if (active) setData(result); })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, "Không thể tải lịch bảo trì.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dateFrom, reloadKey]);

  const schedules = useMemo(() => {
    const byId = new Map<number, MaintenanceRow>();
    for (const room of data?.rooms ?? []) {
      for (const cell of room.cells) {
        if (cell.status !== "MAINTENANCE" || !cell.roomBlockId) continue;
        const existing = byId.get(cell.roomBlockId);
        if (existing) {
          if (cell.date < existing.firstDate) existing.firstDate = cell.date;
          if (cell.date > existing.lastDate) existing.lastDate = cell.date;
          continue;
        }
        byId.set(cell.roomBlockId, {
          id: cell.roomBlockId,
          roomId: room.roomId,
          roomNumber: room.roomNumber,
          roomTypeName: room.roomTypeName,
          reason: cell.maintenanceReason ?? "Bảo trì phòng",
          firstDate: cell.date,
          lastDate: cell.date,
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.firstDate.localeCompare(b.firstDate) || a.roomNumber.localeCompare(b.roomNumber));
  }, [data]);

  function refresh() {
    setLoading(true);
    setError(undefined);
    setReloadKey((value) => value + 1);
  }

  return <>
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end">
        <div>
          <h2 className="text-lg font-semibold">Lịch bảo trì phòng</h2>
          <p className="mt-1 text-sm text-slate-500">Thiết lập và quản lý lịch khóa phòng riêng, không thao tác trong ma trận hiện trạng.</p>
        </div>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500 md:ml-auto">Xem từ ngày<Input className="mt-1 w-44" onChange={(event) => { setLoading(true); setError(undefined); setDateFrom(event.target.value); }} type="date" value={dateFrom} /></label>
        <Button onClick={() => { setLoading(true); setError(undefined); setDateFrom(localDate()); }} variant="secondary">Hôm nay</Button>
        <Button onClick={() => setEditing({})}>Thêm lịch bảo trì</Button>
      </div>

      <p className="my-4 text-xs text-slate-500">Các lịch giao với khoảng 31 ngày kể từ {formatDate(dateFrom)}.</p>
      {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Không thể tải lịch bảo trì" /> : loading ? <DataMessage title="Đang tải lịch bảo trì…" /> : schedules.length === 0 ? <DataMessage description="Bạn có thể thêm lịch mới bằng nút phía trên." title="Không có lịch bảo trì trong khoảng này" /> : <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Phòng</th><th className="px-4 py-3">Lý do</th><th className="px-4 py-3">Khoảng ngày hiển thị</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{schedules.map((schedule) => <tr className="hover:bg-slate-50" key={schedule.id}>
            <td className="px-4 py-3"><b className="text-[var(--primary)]">Phòng {schedule.roomNumber}</b><p className="text-xs text-slate-500">{schedule.roomTypeName}</p></td>
            <td className="px-4 py-3 font-medium">{schedule.reason}</td>
            <td className="px-4 py-3">{formatDate(schedule.firstDate)}{schedule.firstDate !== schedule.lastDate ? ` – ${formatDate(schedule.lastDate)}` : ""}</td>
            <td className="px-4 py-3 text-right"><Button onClick={() => setEditing({ blockId: schedule.id })} variant="secondary">Xem / chỉnh sửa</Button></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>
    {editing ? <RoomBlockEditor blockId={editing.blockId} initialDate={dateFrom} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); refresh(); }} rooms={rooms} /> : null}
  </>;
}
