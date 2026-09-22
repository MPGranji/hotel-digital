"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getBookings } from "@/features/bookings/bookings-api";
import type { BookingListItem } from "@/features/bookings/types";
import { getApiErrorMessage, getApiProblem } from "@/lib/api-client";
import { createInvoice, updateInvoice } from "./invoices-api";
import type { InvoiceItem, InvoiceWriteRequest } from "./types";

export function InvoiceEditor({ invoice, onClose, onSaved }: Readonly<{ invoice?: InvoiceItem; onClose: () => void; onSaved: () => void }>) {
  const [bookingSearch, setBookingSearch] = useState(invoice?.bookingCode ?? "");
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [form, setForm] = useState<InvoiceWriteRequest>({ bookingId: invoice?.bookingId ?? 0, invoiceNumber: invoice?.invoiceNumber ?? "", status: invoice?.status ?? "DRAFT", note: invoice?.note ?? "", version: invoice?.version ?? null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (invoice) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ search: bookingSearch, page: "1", pageSize: "20" });
      void getBookings(params).then((result) => setBookings(result.items)).catch(() => setBookings([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [bookingSearch, invoice]);

  async function save() {
    setSaving(true); setError(undefined); setFieldErrors({});
    try { if (invoice) await updateInvoice(invoice.id, form); else await createInvoice(form); onSaved(); }
    catch (reason) { setFieldErrors(getApiProblem(reason)?.errors ?? {}); setError(getApiErrorMessage(reason, "Không thể lưu hóa đơn.")); }
    finally { setSaving(false); }
  }

  const bookingOptions = invoice ? [{ value: String(invoice.bookingId), label: `${invoice.bookingCode} · ${invoice.customerName} · Phòng ${invoice.roomNumber}` }] : bookings.map((booking) => ({ value: String(booking.id), label: `${booking.bookingCode} · ${booking.customerName} · Phòng ${booking.roomNumber}`, searchText: booking.customerPhone }));
  return <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog"><form className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <div className="flex items-start justify-between border-b border-[var(--border)] pb-4"><div><h2 className="text-lg font-semibold">{invoice ? "Cập nhật hóa đơn" : "Lập hóa đơn"}</h2><p className="mt-1 text-sm text-[var(--muted)]">Hóa đơn lấy số tiền của đặt phòng tại thời điểm bạn lưu.</p></div><Button onClick={onClose} variant="ghost">Đóng</Button></div>
    {error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Field error={fieldErrors.bookingId?.[0]} htmlFor="invoiceBooking" label="Đặt phòng" required><SearchableSelect disabled={Boolean(invoice)} id="invoiceBooking" onChange={(value) => setForm((x) => ({ ...x, bookingId: Number(value) }))} onSearchChange={setBookingSearch} options={bookingOptions} placeholder="Chọn đặt phòng" searchPlaceholder="Nhập mã đặt phòng, tên hoặc SĐT…" searchValue={bookingSearch} value={String(form.bookingId || "")} /></Field></div>
      <div><p className="mb-1.5 text-sm font-medium text-slate-700">Số hóa đơn</p><div className="flex min-h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-[var(--primary)]">{invoice?.invoiceNumber ?? "Hệ thống tự tạo khi lưu"}</div></div>
      <Field error={fieldErrors.status?.[0]} htmlFor="invoiceStatus" label="Trạng thái"><Select id="invoiceStatus" onChange={(e) => setForm((x) => ({ ...x, status: e.target.value as InvoiceWriteRequest["status"] }))} value={form.status}><option value="DRAFT">Nháp</option><option value="ISSUED">Đã phát hành</option><option value="VOID">Đã hủy</option></Select></Field>
      <div className="md:col-span-2"><Field error={fieldErrors.note?.[0]} htmlFor="invoiceNote" label="Ghi chú"><Textarea id="invoiceNote" onChange={(e) => setForm((x) => ({ ...x, note: e.target.value }))} value={form.note} /></Field></div>
    </div>
    <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4"><Button onClick={onClose} variant="secondary">Hủy</Button><Button disabled={saving} type="submit">{saving ? "Đang lưu…" : "Lưu hóa đơn"}</Button></div>
  </form></div>;
}
