"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataMessage, PageHeader, Panel } from "@/components/ui/page";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { InvoiceEditor } from "./invoice-editor";
import { InvoiceViewer } from "./invoice-viewer";
import { getInvoice, getInvoices, updateInvoice } from "./invoices-api";
import type { InvoiceItem } from "./types";

const statusLabels = { DRAFT: "Nháp", ISSUED: "Đã phát hành", VOID: "Đã hủy" };

export function InvoiceDirectory({ initialInvoiceId }: Readonly<{ initialInvoiceId?: number }>) {
  const [query, setQuery] = useState(""); const [search, setSearch] = useState(""); const [status, setStatus] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string>(); const [reloadKey, setReloadKey] = useState(0); const [editing, setEditing] = useState<InvoiceItem | "new">(); const [viewing, setViewing] = useState<InvoiceItem>(); const [voidingId, setVoidingId] = useState<number>();
  useEffect(() => { const timer = window.setTimeout(() => setSearch(query.trim()), 300); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => { let active = true; void getInvoices(search, status).then((data) => { if (active) setItems(data); }).catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải hóa đơn."))).finally(() => setLoading(false)); return () => { active = false; }; }, [reloadKey, search, status]);
  useEffect(() => {
    if (!initialInvoiceId) return;
    let active = true;
    void getInvoice(initialInvoiceId)
      .then((invoice) => { if (active) setViewing(invoice); })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, "Không thể mở hóa đơn.")); });
    return () => { active = false; };
  }, [initialInvoiceId]);
  function refresh() { setLoading(true); setError(undefined); setReloadKey((x) => x + 1); }
  async function voidInvoice(item: InvoiceItem) {
    if (!window.confirm(`Hủy hóa đơn ${item.invoiceNumber}? Hóa đơn vẫn được giữ trong lịch sử.`)) return;
    setVoidingId(item.id); setError(undefined);
    try {
      await updateInvoice(item.id, { bookingId: item.bookingId, invoiceNumber: item.invoiceNumber, status: "VOID", note: item.note ?? "", version: item.version });
      refresh();
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Không thể hủy hóa đơn."));
    } finally { setVoidingId(undefined); }
  }
  return <><PageHeader actions={<Button onClick={() => setEditing("new")}>Lập hóa đơn</Button>} description="Xem số tiền, khoản đã thu và trạng thái hóa đơn của từng đặt phòng." title="Hóa đơn" /><Panel>
    <div className="mb-5 flex flex-col gap-3 border-b border-[var(--border)] pb-5 sm:flex-row"><Input aria-label="Tìm hóa đơn" className="sm:max-w-md" onChange={(e) => { setQuery(e.target.value); setLoading(true); }} placeholder="Số hóa đơn, mã đặt phòng hoặc tên khách" value={query} /><Select aria-label="Lọc theo trạng thái hóa đơn" className="sm:max-w-xs" onChange={(e) => { setStatus(e.target.value); setLoading(true); }} value={status}><option value="">Tất cả trạng thái</option><option value="DRAFT">Nháp</option><option value="ISSUED">Đã phát hành</option><option value="VOID">Đã hủy</option></Select><Button className="sm:ml-auto" onClick={refresh} variant="secondary">Làm mới</Button></div>
    {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Không thể tải dữ liệu" /> : loading ? <DataMessage title="Đang tải hóa đơn…" /> : items.length === 0 ? <DataMessage description="Lập hóa đơn từ một booking đã có." title="Chưa có hóa đơn" /> : <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Hóa đơn / Booking</th><th className="px-3 py-3">Khách / Phòng</th><th className="px-3 py-3">Ngày phát hành</th><th className="px-3 py-3 text-right">Tổng</th><th className="px-3 py-3 text-right">Đã trả</th><th className="px-3 py-3">Trạng thái</th><th className="px-3 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id}><td className="px-3 py-3"><b className="text-[var(--primary)]">{item.invoiceNumber}</b><p className="text-xs text-slate-500">{item.bookingCode}</p></td><td className="px-3 py-3">{item.customerName}<p className="text-xs text-slate-500">Phòng {item.roomNumber}</p></td><td className="px-3 py-3">{formatDateTime(item.issuedAt)}</td><td className="px-3 py-3 text-right">{formatCurrency(item.grossAmount)}</td><td className="px-3 py-3 text-right">{formatCurrency(item.paidAmount)}</td><td className="px-3 py-3">{statusLabels[item.status]}</td><td className="px-3 py-3 text-right"><div className="flex justify-end gap-2"><Button onClick={() => setViewing(item)} variant="info">Xem hóa đơn</Button><Button onClick={() => setEditing(item)} variant="warning">Chỉnh sửa</Button>{item.status !== "VOID" ? <Button disabled={voidingId === item.id} onClick={() => void voidInvoice(item)} variant="danger">{voidingId === item.id ? "Đang hủy…" : "Hủy hóa đơn"}</Button> : null}</div></td></tr>)}</tbody></table></div>}
  </Panel>{viewing ? <InvoiceViewer invoice={viewing} onClose={() => setViewing(undefined)} /> : null}{editing ? <InvoiceEditor invoice={editing === "new" ? undefined : editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); refresh(); }} /> : null}</>;
}
