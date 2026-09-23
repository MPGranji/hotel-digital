"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataMessage, PageHeader, Panel } from "@/components/ui/page";
import { getApiErrorMessage } from "@/lib/api-client";
import { useLiveRevision } from "@/features/realtime/live-updates-provider";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { InvoiceEditor } from "./invoice-editor";
import { InvoiceViewer } from "./invoice-viewer";
import { getInvoice, getInvoices } from "./invoices-api";
import type { InvoiceItem } from "./types";

const statusLabels = { DRAFT: "Nháp", ISSUED: "Đã phát hành", VOID: "Đã hủy · không tính doanh thu" };

export function InvoiceDirectory({ initialInvoiceId }: Readonly<{ initialInvoiceId?: number }>) {
  const liveRevision = useLiveRevision();
  const [query, setQuery] = useState(""); const [search, setSearch] = useState(""); const [status, setStatus] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string>(); const [detailError, setDetailError] = useState<string>(); const [reloadKey, setReloadKey] = useState(0); const [editing, setEditing] = useState<InvoiceItem | "new">(); const [viewing, setViewing] = useState<InvoiceItem>();
  useEffect(() => { const timer = window.setTimeout(() => setSearch(query.trim()), 300); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => { let active = true; void getInvoices(search, status).then((data) => { if (active) { setItems(data); setError(undefined); } }).catch((reason) => { if (active) setError(getApiErrorMessage(reason, "Không thể tải hóa đơn.")); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [reloadKey, search, status, liveRevision]);
  useEffect(() => {
    if (!initialInvoiceId) return;
    let active = true;
    void getInvoice(initialInvoiceId)
      .then((invoice) => { if (active) { setViewing(invoice); setDetailError(undefined); } })
      .catch((reason) => { if (active) setDetailError(getApiErrorMessage(reason, "Không thể mở hóa đơn.")); });
    return () => { active = false; };
  }, [initialInvoiceId]);
  useEffect(() => {
    const invoiceId = viewing?.id;
    if (!invoiceId || liveRevision === 0) return;
    let active = true;
    void getInvoice(invoiceId)
      .then((invoice) => { if (active) { setViewing(invoice); setDetailError(undefined); } })
      .catch((reason) => { if (active) setDetailError(getApiErrorMessage(reason, "Không thể làm mới hóa đơn đang xem.")); });
    return () => { active = false; };
  }, [liveRevision, viewing?.id]);
  function refresh() { setLoading(true); setError(undefined); setReloadKey((x) => x + 1); }
  return <><PageHeader description="Hóa đơn đi theo booking. Hóa đơn đã hủy giữ số tiền gốc để tra cứu, không tính doanh thu." title="Hóa đơn" /><Panel>
    <div className="mb-5 flex flex-col gap-3 border-b border-[var(--border)] pb-5 sm:flex-row"><Input aria-label="Tìm hóa đơn" className="sm:max-w-md" onChange={(e) => { setQuery(e.target.value); setLoading(true); }} placeholder="Số hóa đơn, mã đặt phòng hoặc tên khách" value={query} /><Select aria-label="Lọc theo trạng thái hóa đơn" className="sm:max-w-xs" onChange={(e) => { setStatus(e.target.value); setLoading(true); }} value={status}><option value="">Tất cả trạng thái</option><option value="DRAFT">Nháp</option><option value="ISSUED">Đã phát hành</option><option value="VOID">Đã hủy</option></Select><Button className="sm:ml-auto" onClick={refresh} variant="secondary">Làm mới</Button></div>
    {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Không thể tải dữ liệu" /> : loading ? <DataMessage title="Đang tải hóa đơn…" /> : items.length === 0 ? <DataMessage description="Hóa đơn sẽ được tạo cùng booking." title="Chưa có hóa đơn" /> : <div className="overflow-x-auto rounded-lg border border-[var(--border)]"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[var(--sidebar)] text-xs text-[var(--muted)]"><tr><th className="px-3 py-3">Hóa đơn / Đặt phòng</th><th className="px-3 py-3">Khách / Phòng</th><th className="px-3 py-3">Ngày phát hành</th><th className="px-3 py-3 text-right">Tổng</th><th className="px-3 py-3 text-right">Đã trả</th><th className="px-3 py-3">Trạng thái</th><th className="px-3 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr className="hover:bg-[var(--sidebar)]" key={item.id}><td className="px-3 py-3"><strong className="font-semibold text-[var(--primary)]">{item.invoiceNumber}</strong><p className="text-xs text-[var(--muted)]">{item.bookingCode}</p></td><td className="px-3 py-3">{item.customerName}<p className="text-xs text-[var(--muted)]">Phòng {item.roomNumber}</p></td><td className="px-3 py-3">{formatDateTime(item.issuedAt)}</td><td className="px-3 py-3 text-right">{formatCurrency(item.grossAmount)}</td><td className="px-3 py-3 text-right">{formatCurrency(item.paidAmount)}</td><td className="px-3 py-3">{statusLabels[item.status]}</td><td className="px-3 py-3 text-right"><div className="flex justify-end gap-1"><Button onClick={() => setViewing(item)} size="sm" variant="ghost">Xem</Button><Button onClick={() => setEditing(item)} size="sm" variant="secondary">Sửa ghi chú</Button></div></td></tr>)}</tbody></table></div>}
  </Panel>{detailError ? <DataMessage description={detailError} title="Không thể tải chi tiết hóa đơn" /> : null}{viewing ? <InvoiceViewer invoice={viewing} onClose={() => setViewing(undefined)} /> : null}{editing ? <InvoiceEditor invoice={editing === "new" ? undefined : editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); refresh(); }} /> : null}</>;
}
