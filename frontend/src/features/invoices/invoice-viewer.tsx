"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getBooking } from "@/features/bookings/bookings-api";
import type { BookingDetail } from "@/features/bookings/types";
import { getApiErrorMessage } from "@/lib/api-client";
import { useLiveRevision } from "@/features/realtime/live-updates-provider";
import { formatCurrency, formatDate, formatDateTime, formatUtcDateTime } from "@/lib/format";
import type { InvoiceItem } from "./types";

const statusLabels: Record<InvoiceItem["status"], string> = {
  DRAFT: "Bản nháp",
  ISSUED: "Đã phát hành",
  VOID: "Đã hủy",
};

interface ChargeLine {
  label: string;
  description: string;
  amount: number;
  subtract?: boolean;
}

export function InvoiceViewer({ invoice, onClose }: Readonly<{ invoice: InvoiceItem; onClose: () => void }>) {
  const liveRevision = useLiveRevision();
  const [booking, setBooking] = useState<BookingDetail>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void getBooking(invoice.bookingId)
      .then((result) => { if (active) { setBooking(result); setError(undefined); } })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, "Không thể tải chi tiết đặt phòng.")); });
    return () => { active = false; };
  }, [invoice.bookingId, liveRevision]);

  const chargeLines: ChargeLine[] = booking ? [
    {
      label: "Tiền phòng",
      description: `${booking.roomTypeName} · ${booking.billedNights} đêm × ${formatCurrency(booking.averageRoomRate)}`,
      amount: booking.roomRevenue,
    },
    ...(booking.serviceRevenue > 0 ? [{ label: "Dịch vụ", description: "Dịch vụ trong thời gian lưu trú", amount: booking.serviceRevenue }] : []),
    ...(booking.surchargeAmount > 0 ? [{ label: "Phụ thu", description: "Phụ thu đặt phòng", amount: booking.surchargeAmount }] : []),
    ...(booking.discountAmount > 0 ? [{
      label: "Giảm giá",
      description: booking.discountReason || booking.promotionCode || "Giảm giá đặt phòng",
      amount: booking.discountAmount,
      subtract: true,
    }] : []),
  ] : [];

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-8" role="dialog">
      <article className="invoice-print-area w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        <div className="invoice-print-hide flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-8">
          <div>
            <h2 className="text-lg font-bold">Hóa đơn lưu trú</h2>
            <p className="text-sm text-slate-500">Chi tiết tiền phòng và các khoản thanh toán của đặt phòng.</p>
          </div>
          <div className="flex gap-2">
            {invoice.status !== "VOID" ? <Button disabled={!booking} onClick={() => window.print()} variant="secondary">In hóa đơn</Button> : null}
            <Button onClick={onClose} variant="ghost">Đóng</Button>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          {invoice.status === "VOID" ? <div className="mb-6 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 text-center font-bold text-red-800">HÓA ĐƠN ĐÃ HỦY · Không tính doanh thu · Không dùng để thu tiền</div> : null}
          <header className="flex flex-col justify-between gap-6 border-b-2 border-[var(--primary)] pb-7 sm:flex-row">
            <div>
              <p className="text-sm font-bold tracking-[0.24em] text-[var(--primary)]">HOTEL DIGITAL</p>
              <p className="mt-1 text-sm text-slate-500">Vận hành khách sạn</p>
              <h1 className="mt-6 text-3xl font-bold uppercase tracking-wide">{invoice.status === "VOID" ? "Hóa đơn đã hủy" : "Hóa đơn lưu trú"}</h1>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-slate-500">Số hóa đơn</p>
              <p className="text-xl font-bold text-[var(--primary)]">{invoice.invoiceNumber}</p>
              <p className="mt-3 text-sm"><span className="text-slate-500">{invoice.issuedAt ? "Ngày phát hành" : "Ngày tạo"}:</span> {invoice.issuedAt ? formatDateTime(invoice.issuedAt) : formatUtcDateTime(invoice.createdAt)}</p>
              <p className="mt-1 text-sm"><span className="text-slate-500">Trạng thái:</span> {statusLabels[invoice.status]}</p>
            </div>
          </header>

          <section className="grid gap-6 border-b border-slate-200 py-7 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Khách hàng</p>
              <p className="mt-2 text-lg font-bold">{invoice.customerName}</p>
              <p className="mt-1 text-sm text-slate-600">Mã đặt phòng: {invoice.bookingCode}</p>
              {booking?.externalBookingCode ? <p className="mt-1 text-sm text-slate-600">Mã bên ngoài: {booking.externalBookingCode}</p> : null}
              {booking ? <p className="mt-1 text-sm text-slate-600">Kênh đặt: {booking.channelName}</p> : null}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Thông tin lưu trú</p>
              <p className="mt-2 text-lg font-bold">Phòng {invoice.roomNumber}{booking ? ` · ${booking.roomTypeName}` : ""}</p>
              {booking ? <>
                <p className="mt-1 text-sm text-slate-600">Ngày đến: {formatDate(booking.checkInAt)}</p>
                <p className="mt-1 text-sm text-slate-600">Ngày đi: {formatDate(booking.checkOutAt)}</p>
                <p className="mt-1 text-sm text-slate-600">Số đêm tính tiền: {booking.billedNights}</p>
              </> : null}
            </div>
          </section>

          {error ? <p className="my-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          {!booking && !error ? <p className="my-6 text-sm text-slate-500">Đang tải chi tiết tiền phòng…</p> : null}

          <div className="mt-7 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="px-4 py-3">Nội dung</th><th className="px-4 py-3">Diễn giải</th><th className="px-4 py-3 text-right">Thành tiền</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {chargeLines.map((line) => <tr key={line.label}>
                  <td className="px-4 py-3 font-semibold">{line.label}</td>
                  <td className="px-4 py-3 text-slate-600">{line.description}</td>
                  <td className="px-4 py-3 text-right font-medium">{line.subtract ? "− " : ""}{formatCurrency(line.amount)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>

          <section className="ml-auto mt-7 w-full max-w-sm space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">{invoice.status === "VOID" ? "Giá trị lượt ở (tham khảo)" : "Chi phí lượt ở"}</span><strong>{formatCurrency(invoice.grossAmount)}</strong></div>
            {booking && booking.previousDebt > 0 && invoice.status !== "VOID" ? <div className="flex justify-between"><span className="text-slate-600">Nợ trước chuyển sang</span><strong>{formatCurrency(booking.previousDebt)}</strong></div> : null}
            {booking && booking.previousDebt > 0 && invoice.status !== "VOID" ? <div className="flex justify-between border-t border-slate-200 pt-2"><span className="font-semibold">Tổng cần thanh toán</span><strong>{formatCurrency(invoice.grossAmount + booking.previousDebt)}</strong></div> : null}
            <div className="flex justify-between"><span className="text-slate-600">{invoice.status === "VOID" ? "Cọc còn giữ" : "Đã thanh toán"}</span><strong className={invoice.status === "VOID" ? "text-amber-700" : "text-emerald-700"}>{formatCurrency(invoice.paidAmount)}</strong></div>
            {invoice.status !== "VOID" && invoice.debtAmount > 0 ? <div className="flex justify-between"><span className="text-slate-600">Ghi nợ</span><strong>{formatCurrency(invoice.debtAmount)}</strong></div> : null}
            <div className="flex justify-between border-t-2 border-slate-900 pt-3 text-lg"><span className="font-bold">{invoice.status === "VOID" ? "Doanh thu hóa đơn" : "Còn phải thu"}</span><strong className="text-[var(--primary)]">{formatCurrency(invoice.status === "VOID" ? 0 : invoice.balanceDue)}</strong></div>
          </section>

          {invoice.note ? <section className="mt-8 rounded-lg bg-slate-50 p-4 text-sm"><strong>Ghi chú:</strong> <span className="text-slate-600">{invoice.note}</span></section> : null}
          {invoice.status !== "VOID" ? <footer className="mt-10 border-t border-slate-200 pt-5 text-center text-sm text-slate-500">Cảm ơn quý khách đã sử dụng dịch vụ của Hotel Digital.</footer> : null}
        </div>
      </article>
    </div>
  );
}
