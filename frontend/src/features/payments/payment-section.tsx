"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { DataMessage, SectionTitle } from "@/components/ui/page";
import { getApiErrorMessage, getApiProblem } from "@/lib/api-client";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { useBookingForm } from "@/features/bookings/use-booking-form";
import { createPayment, getPayments } from "./payments-api";
import type { PaymentItem, PaymentMethod } from "./types";

type FormModel = ReturnType<typeof useBookingForm>;

const methodLabels: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  TRANSFER: "Chuyển khoản",
};

export function PaymentSection({ model, readOnly = false }: Readonly<{ model: FormModel; readOnly?: boolean }>) {
  const { booking, refreshBooking } = model;
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [referenceCode, setReferenceCode] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const bookingId = booking?.id;

  useEffect(() => {
    if (!bookingId) return;
    let active = true;
    void getPayments(bookingId)
      .then((payments) => { if (active) setItems(payments); })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, "Không thể tải lịch sử thanh toán.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingId]);

  if (!booking) return null;
  const currentBooking = booking;

  const totalToSettle = currentBooking.previousDebt + currentBooking.grossRevenue;
  const payableAmount = Math.max(totalToSettle - currentBooking.debtAmount, 0);
  const amountToCollect = Math.max(payableAmount - currentBooking.paidAmount, 0);
  const closed = currentBooking.status === "CHECKED_OUT" || currentBooking.status === "CANCELLED" || currentBooking.status === "NO_SHOW";

  async function save() {
    setSaving(true);
    setError(undefined);
    setFieldErrors({});
    try {
      await createPayment(currentBooking.id, {
        amount: Number(amount),
        method,
        referenceCode,
        note,
      });
      const [payments, refreshed] = await Promise.all([getPayments(currentBooking.id), refreshBooking()]);
      setItems(payments);
      setAmount(refreshed ? String(Math.max(refreshed.previousDebt + refreshed.grossRevenue - refreshed.paidAmount - refreshed.debtAmount, 0)) : "");
      setReferenceCode("");
      setNote("");
    } catch (reason) {
      setFieldErrors(getApiProblem(reason)?.errors ?? {});
      setError(getApiErrorMessage(reason, "Không thể ghi nhận thanh toán."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionTitle>4. Sổ thu tiền</SectionTitle>
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:divide-x sm:divide-slate-300">
        <MoneyValue label="Tổng cần thu" value={totalToSettle} valueClass="text-[var(--primary)]" />
        <MoneyValue label="Đã thu" value={currentBooking.paidAmount} valueClass="text-emerald-700" />
        <MoneyValue label="Cần thu khi trả phòng" value={amountToCollect} valueClass={amountToCollect > 0 ? "text-amber-700" : "text-emerald-700"} />
        <p className="flex items-center justify-between gap-2 sm:px-4"><span className="font-medium text-slate-600">Trạng thái:</span><b className={paymentStatusClass(currentBooking.paidAmount, payableAmount)}>{paymentStatusLabel(currentBooking.paidAmount, payableAmount)}</b></p>
      </div>

      {!closed && !readOnly ? (
        <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2 xl:grid-cols-[minmax(160px,0.8fr)_minmax(190px,0.9fr)_minmax(190px,1fr)_minmax(220px,1.2fr)_auto] xl:items-end">
          <Field error={fieldErrors.amount?.[0]} htmlFor="paymentAmount" label="Số tiền thu" required>
            <MoneyInput id="paymentAmount" onChange={setAmount} value={amount} />
          </Field>
          <Field error={fieldErrors.method?.[0]} htmlFor="paymentMethodRecord" label="Phương thức" required>
            <Select id="paymentMethodRecord" onChange={(event) => setMethod(event.target.value as PaymentMethod)} value={method}>
              <option value="CASH">Tiền mặt</option>
              <option value="TRANSFER">Chuyển khoản</option>
              <option value="CARD">Thẻ</option>
            </Select>
          </Field>
          <Field error={fieldErrors.referenceCode?.[0]} htmlFor="paymentReference" label="Mã giao dịch (nếu có)">
            <Input id="paymentReference" onChange={(event) => setReferenceCode(event.target.value)} placeholder="Không bắt buộc" value={referenceCode} />
          </Field>
          <Field error={fieldErrors.note?.[0]} htmlFor="paymentNote" label="Ghi chú">
            <Input id="paymentNote" onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: tiền cọc" value={note} />
          </Field>
          <Button disabled={saving} onClick={() => void save()} type="button">{saving ? "Đang lưu…" : "Ghi nhận thu"}</Button>
        </div>
      ) : null}

      {error ? <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <div className="mt-4">
        {loading ? <DataMessage title="Đang tải sổ thu tiền…" /> : items.length === 0 ? <DataMessage description="Có thể ghi nhận tiền cọc hoặc khoản thu tại quầy. Đây chỉ là sổ theo dõi nội bộ, không kết nối cổng thanh toán." title="Chưa ghi nhận khoản thu" /> : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-[var(--sidebar)] text-xs text-[var(--muted)]"><tr><th className="px-4 py-3">Thời gian</th><th className="px-4 py-3">Phương thức</th><th className="px-4 py-3">Mã / Ghi chú</th><th className="px-4 py-3 text-right">Số tiền</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{items.map((payment) => <tr key={payment.id}><td className="px-4 py-3">{formatDateTime(payment.paidAt)}</td><td className="px-4 py-3">{methodLabels[payment.method]}</td><td className="px-4 py-3 text-slate-500"><p>{payment.referenceCode || "—"}</p>{payment.note ? <p className="text-xs">{payment.note}</p> : null}</td><td className="px-4 py-3 text-right font-medium text-emerald-700">{formatCurrency(payment.amount)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MoneyValue({ label, value, valueClass }: Readonly<{ label: string; value: number; valueClass: string }>) {
  return <p className="flex items-baseline justify-between gap-2 sm:justify-start sm:px-4 sm:first:pl-0"><span className="font-medium text-slate-600">{label}:</span><b className={`tabular-nums ${valueClass}`}>{formatCurrency(value)}</b></p>;
}

function paymentStatusLabel(paid: number, gross: number) {
  if (paid <= 0) return "Chưa thu";
  return paid >= gross ? "Đã thu đủ" : "Thu một phần";
}

function paymentStatusClass(paid: number, gross: number) {
  if (paid <= 0) return "text-slate-700";
  return paid >= gross ? "text-emerald-700" : "text-amber-700";
}
