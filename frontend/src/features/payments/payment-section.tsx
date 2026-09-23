"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { DataMessage, SectionTitle } from "@/components/ui/page";
import { getApiErrorMessage, getApiProblem } from "@/lib/api-client";
import { useLiveRevision } from "@/features/realtime/live-updates-provider";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { useBookingForm } from "@/features/bookings/use-booking-form";
import { createPayment, getPayments, refundDeposit } from "./payments-api";
import type { PaymentItem, PaymentMethod } from "./types";

type FormModel = ReturnType<typeof useBookingForm>;

const methodLabels: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  TRANSFER: "Chuyển khoản",
};

export function PaymentSection({ model, readOnly = false }: Readonly<{ model: FormModel; readOnly?: boolean }>) {
  const liveRevision = useLiveRevision();
  const { booking, refreshBooking } = model;
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [referenceCode, setReferenceCode] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [error, setError] = useState<string>();
  const [loadError, setLoadError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const bookingId = booking?.id;
  const blockedByBookingEdit = model.hasUnsavedChanges || model.remoteChangeAvailable;

  useEffect(() => {
    if (!bookingId) return;
    let active = true;
    void getPayments(bookingId)
      .then((payments) => { if (active) { setItems(payments); setLoadError(undefined); } })
      .catch((reason) => { if (active) setLoadError(getApiErrorMessage(reason, "Không thể tải lịch sử thanh toán.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingId, liveRevision]);

  if (!booking) return null;
  const currentBooking = booking;

  const totalToSettle = currentBooking.previousDebt + currentBooking.grossRevenue;
  const payableAmount = Math.max(totalToSettle - currentBooking.debtAmount, 0);
  const amountToCollect = Math.max(payableAmount - currentBooking.paidAmount, 0);
  const closed = currentBooking.status === "CHECKED_OUT" || currentBooking.status === "CANCELLED" || currentBooking.status === "NO_SHOW";
  const cancelled = currentBooking.status === "CANCELLED" || currentBooking.status === "NO_SHOW";
  const hasRefund = items.some((item) => item.amount < 0);
  const depositStatus = currentBooking.paidAmount > 0 ? "Cần hoàn cọc" : loading ? "Đang kiểm tra cọc…" : hasRefund ? "Đã hoàn cọc" : loadError ? "Chưa kiểm tra được cọc" : "Không có cọc";

  function fillRemainingAmount() {
    setAmount(String(amountToCollect));
    setError(undefined);
    setFieldErrors((current) => {
      if (!current.amount) return current;
      const next = { ...current };
      delete next.amount;
      return next;
    });
  }

  async function confirmDepositRefund() {
    if (blockedByBookingEdit) return;
    setSaving(true);
    setError(undefined);
    try {
      await refundDeposit(currentBooking.id);
      const [payments] = await Promise.all([getPayments(currentBooking.id), refreshBooking()]);
      setItems(payments);
      setConfirmRefund(false);
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Không thể ghi nhận hoàn cọc."));
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (blockedByBookingEdit) return;
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
      const remaining = refreshed ? Math.max(refreshed.previousDebt + refreshed.grossRevenue - refreshed.paidAmount - refreshed.debtAmount, 0) : 0;
      setAmount(remaining > 0 ? String(remaining) : "");
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
    <div id="booking-payments">
      <SectionTitle>{cancelled ? "4. Cọc và hoàn tiền" : "4. Thu tiền"}</SectionTitle>
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:divide-x sm:divide-slate-300">
        {!cancelled ? <MoneyValue label="Tổng cần thu" value={totalToSettle} valueClass="text-[var(--primary)]" /> : null}
        <MoneyValue label={cancelled ? "Cọc chưa hoàn" : "Đã thu"} value={currentBooking.paidAmount} valueClass={cancelled && currentBooking.paidAmount > 0 ? "text-amber-700" : "text-emerald-700"} />
        {!cancelled && currentBooking.debtAmount > 0 ? <MoneyValue label="Đã ghi công nợ" value={currentBooking.debtAmount} valueClass="text-[#7b5f3a]" /> : null}
        {!closed ? <MoneyValue label="Cần thu khi trả phòng" value={amountToCollect} valueClass={amountToCollect > 0 ? "text-amber-700" : "text-emerald-700"} /> : null}
        <p className="flex items-center justify-between gap-2 sm:px-4"><span className="font-medium text-slate-600">Trạng thái:</span><b className={cancelled ? currentBooking.paidAmount > 0 ? "text-amber-700" : "text-emerald-700" : paymentStatusClass(currentBooking.paidAmount, totalToSettle, currentBooking.debtAmount)}>{cancelled ? depositStatus : paymentStatusLabel(currentBooking.paidAmount, totalToSettle, currentBooking.debtAmount)}</b></p>
      </div>

      {blockedByBookingEdit && !readOnly ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{model.remoteChangeAvailable ? "Tải phiên bản đặt phòng mới nhất trước khi thu hoặc hoàn tiền." : "Lưu hoặc bỏ các thay đổi đặt phòng trước khi thu hoặc hoàn tiền."}</p> : null}

      {cancelled && currentBooking.paidAmount > 0 && !readOnly ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold text-amber-900">Còn {formatCurrency(currentBooking.paidAmount)} tiền cọc cần xử lý</p><p className="mt-1 text-amber-800">Sau khi đã tự trả tiền cho khách, xác nhận tại đây để sổ thu tiền ghi nhận khoản hoàn. Nút này không tự chuyển tiền.</p>{confirmRefund ? <div className="mt-3 flex flex-wrap gap-2"><Button disabled={saving || blockedByBookingEdit} onClick={() => void confirmDepositRefund()} type="button">{saving ? "Đang ghi nhận…" : "Xác nhận đã hoàn cọc"}</Button><Button disabled={saving} onClick={() => setConfirmRefund(false)} type="button" variant="secondary">Quay lại</Button></div> : <Button className="mt-3" disabled={blockedByBookingEdit} onClick={() => setConfirmRefund(true)} type="button" variant="secondary">Hoàn cọc</Button>}</div> : null}

      {!closed && !readOnly && amountToCollect > 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-4"><p className="text-sm text-[var(--muted)]">Đã nhận đủ tiền từ khách? Điền nhanh số còn phải thu:</p><Button className="border-[#a9c7ce] bg-[var(--nav-active)] font-semibold text-[var(--primary-strong)] hover:bg-[#d2e4e7]" disabled={saving} onClick={fillRemainingAmount} size="sm" type="button" variant="secondary">Điền đủ {formatCurrency(amountToCollect)}</Button></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(160px,0.8fr)_minmax(190px,0.9fr)_minmax(190px,1fr)_minmax(220px,1.2fr)_auto] xl:items-end">
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
            <Button disabled={saving || blockedByBookingEdit} onClick={() => void save()} type="button">{saving ? "Đang lưu…" : "Ghi nhận thu"}</Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {loadError ? <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p> : null}
      <div className="mt-4">
        {loading ? <DataMessage title="Đang tải sổ thu tiền…" /> : items.length === 0 ? <DataMessage description={cancelled ? "Booking này không có khoản cọc trong sổ thu tiền." : closed ? currentBooking.debtAmount > 0 ? "Khoản chưa thu đã được chuyển công nợ; booking này đã kết thúc." : "Booking đã kết thúc và không có giao dịch thu tiền được ghi trong sổ." : "Bạn có thể ghi nhận tiền cọc hoặc khoản thu tại quầy; hệ thống không tự chuyển tiền."} title={cancelled ? "Không có cọc đã thu" : "Chưa có giao dịch thu tiền"} /> : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-[var(--sidebar)] text-xs text-[var(--muted)]"><tr><th className="px-4 py-3">Thời gian</th><th className="px-4 py-3">Phương thức</th><th className="px-4 py-3">Mã / Ghi chú</th><th className="px-4 py-3 text-right">Số tiền</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{items.map((payment) => <tr key={payment.id}><td className="px-4 py-3">{formatDateTime(payment.paidAt)}</td><td className="px-4 py-3">{methodLabels[payment.method]}</td><td className="px-4 py-3 text-slate-500"><p className={payment.amount < 0 ? "font-semibold text-amber-800" : ""}>{payment.amount < 0 ? "Hoàn cọc" : payment.referenceCode || "Khoản thu"}</p>{payment.note ? <p className="text-xs">{payment.note}</p> : null}</td><td className={`px-4 py-3 text-right font-semibold ${payment.amount < 0 ? "text-amber-800" : "text-emerald-700"}`}>{formatCurrency(payment.amount)}</td></tr>)}</tbody>
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

function paymentStatusLabel(paid: number, gross: number, debt: number) {
  if (debt > 0 && paid + debt >= gross) return paid > 0 ? "Thu một phần · còn lại ghi nợ" : "Đã ghi công nợ";
  if (paid <= 0) return "Chưa thu";
  return paid >= gross ? "Đã thu đủ" : "Thu một phần";
}

function paymentStatusClass(paid: number, gross: number, debt: number) {
  if (debt > 0 && paid + debt >= gross) return "text-[#7b5f3a]";
  if (paid <= 0) return "text-slate-700";
  return paid >= gross ? "text-emerald-700" : "text-amber-700";
}
