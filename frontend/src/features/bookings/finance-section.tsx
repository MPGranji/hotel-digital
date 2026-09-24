import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { SectionTitle } from "@/components/ui/page";
import { formatCurrency } from "@/lib/format";
import type { BookingFormState, PaymentMethod } from "./booking-form-state";
import type { useBookingForm } from "./use-booking-form";

type FormModel = ReturnType<typeof useBookingForm>;
type MoneyField = keyof Pick<BookingFormState,
  "roomRevenue" | "serviceRevenue" | "surchargeAmount" | "discountAmount" | "previousDebt" |
  "cashAmount" | "cardAmount" | "transferAmount" | "debtAmount">;

const additionalMoneyFields: Array<{ key: MoneyField; label: string }> = [
  { key: "serviceRevenue", label: "Dịch vụ" },
  { key: "surchargeAmount", label: "Phụ thu" },
  { key: "discountAmount", label: "Giảm giá" },
  { key: "previousDebt", label: "Nợ trước" },
  { key: "debtAmount", label: "Chuyển công nợ" },
];

const paymentFields: Array<{ key: "cashAmount" | "cardAmount" | "transferAmount"; label: string }> = [
  { key: "cashAmount", label: "Tiền mặt" },
  { key: "cardAmount", label: "Thẻ" },
  { key: "transferAmount", label: "Chuyển khoản" },
];

export function FinanceSection({ model, disabled }: Readonly<{ model: FormModel; disabled: boolean }>) {
  const { form, booking, options, fieldErrors, summary, updateField } = model;
  const [chargeKind, setChargeKind] = useState<"serviceRevenue" | "surchargeAmount">("serviceRevenue");
  const [chargeDescription, setChargeDescription] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeError, setChargeError] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundReferences, setRefundReferences] = useState({ CASH: "", CARD: "", TRANSFER: "" });
  const [refundAmounts, setRefundAmounts] = useState({ CASH: "", CARD: "", TRANSFER: "" });
  const [confirmRefund, setConfirmRefund] = useState(false);
  const selectedChannel = options.channels.find((channel) => String(channel.id) === form.channelId);
  const usesCounterRate = selectedChannel?.category === "OFFLINE";
  const paymentMethod = form.paymentMethod;
  const hasAdditionalDetails = additionalMoneyFields.some(({ key }) => Number(form[key]) > 0)
    || Boolean(form.discountReason || form.promotionCode)
    || (!booking && paymentMethod === "split");
  const [detailsOpen, setDetailsOpen] = useState(booking?.status === "CHECKED_IN" || hasAdditionalDetails);
  const refundNeeded = Math.max(0, -summary.balance);
  const refundTotal = Object.values(refundAmounts).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const paidByMethod = { CASH: booking?.cashAmount ?? 0, CARD: booking?.cardAmount ?? 0, TRANSFER: booking?.transferAmount ?? 0 };
  const refundValid = refundNeeded > 0 && summary.debt === 0 && refundTotal === refundNeeded && refundReason.trim().length > 0
    && (Object.keys(paidByMethod) as Array<keyof typeof paidByMethod>).every((method) => (Number(refundAmounts[method]) || 0) <= paidByMethod[method]);

  function addCharge() {
    if (!model.recordAdditionalCharge(chargeKind, chargeAmount, chargeDescription)) {
      setChargeError("Nhập mô tả và số tiền lớn hơn 0; ghi chú đặt phòng không được vượt 1.000 ký tự.");
      return;
    }
    setChargeDescription("");
    setChargeAmount("");
    setChargeError("");
    setDetailsOpen(true);
  }

  function suggestRefundSplit() {
    let remaining = refundNeeded;
    const next = { CASH: "", CARD: "", TRANSFER: "" };
    for (const method of ["CASH", "CARD", "TRANSFER"] as const) {
      const amount = Math.min(remaining, paidByMethod[method]);
      if (amount > 0) next[method] = String(amount);
      remaining -= amount;
    }
    setRefundAmounts(next);
    setConfirmRefund(false);
  }

  async function submitRefund() {
    if (!refundValid || disabled || model.saving) return;
    const refunds = (["CASH", "CARD", "TRANSFER"] as const)
      .filter((method) => Number(refundAmounts[method]) > 0)
      .map((method) => ({ amount: Number(refundAmounts[method]), method, reason: refundReason.trim(), referenceCode: refundReferences[method].trim() }));
    await model.submit(refunds);
    setConfirmRefund(false);
  }

  function changePaymentMethod(method: PaymentMethod) {
    if (method === "split") {
      setDetailsOpen(true);
      updateField("paymentMethod", method);
      return;
    }

    const currentPaid = String(summary.paid);
    updateField("paymentMethod", method);
    paymentFields.forEach(({ key }) => updateField(key, method === key ? currentPaid : "0"));
  }

  function changePaidAmount(value: string) {
    if (paymentMethod === "unpaid" || paymentMethod === "split") return;
    paymentFields.forEach(({ key }) => updateField(key, paymentMethod === key ? value : "0"));
  }

  return (
    <div className="booking-section scroll-mt-6" id="booking-finance">
      <SectionTitle>3. Tiền phòng và chi phí</SectionTitle>
      {!booking && form.roomMode === "multiple" ? <p className="mb-4 rounded-lg border border-[#bdd1cb] bg-[var(--nav-active)] px-4 py-3 text-sm text-[var(--primary-strong)]">Các khoản bên dưới áp dụng <b>cho mỗi phòng</b>. Nếu chọn nhiều hạng phòng, hãy kiểm tra mức giá chung và sửa tiền phòng trên từng booking sau khi tạo nếu giá khác nhau.</p> : null}
      <div className={`grid gap-4 ${booking ? "max-w-2xl" : "md:grid-cols-3"}`}>
        <Field error={fieldErrors.roomRevenue?.[0]} hint={usesCounterRate ? "Tự tính theo bảng giá tại quầy; bạn vẫn có thể điều chỉnh." : "Nhập tiền phòng theo giá của kênh đặt."} htmlFor="roomRevenue" label={!booking && form.roomMode === "multiple" ? "Tiền phòng mỗi phòng" : "Tiền phòng"} required>
          <MoneyInput disabled={disabled} id="roomRevenue" onChange={(value) => updateField("roomRevenue", value)} value={form.roomRevenue} />
        </Field>
        {!booking ? <Field htmlFor="paymentMethod" label="Phương thức tiền cọc">
          <Select disabled={disabled} id="paymentMethod" onChange={(event) => changePaymentMethod(event.target.value as PaymentMethod)} value={paymentMethod}>
            <option value="unpaid">Chưa thanh toán</option>
            <option value="cashAmount">Tiền mặt</option>
            <option value="transferAmount">Chuyển khoản</option>
            <option value="cardAmount">Thẻ</option>
            {paymentMethod === "split" ? <option value="split">Nhiều phương thức</option> : null}
          </Select>
        </Field> : null}
        {!booking ? <Field error={getPaymentError(fieldErrors)} hint={paymentMethod === "split" ? "Xem chi tiết từng phương thức bên dưới." : undefined} htmlFor="paidAmount" label={form.roomMode === "multiple" ? "Tiền cọc mỗi phòng" : "Tiền cọc đã thu"}>
          <MoneyInput disabled={disabled || paymentMethod === "unpaid" || paymentMethod === "split"} id="paidAmount" onChange={changePaidAmount} value={String(summary.paid)} />
        </Field> : null}
      </div>

      {booking && model.suggestedRoomRevenue !== undefined && model.suggestedRoomRevenue !== Number(form.roomRevenue) && usesCounterRate && !disabled ? <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span className="text-[var(--muted)]">Giá theo bảng giá cho lịch đang chọn: {formatCurrency(model.suggestedRoomRevenue)}.</span><Button onClick={model.applySuggestedRoomRevenue} size="sm" variant="secondary">Dùng giá gợi ý</Button></div> : null}

      {booking && !disabled ? <div className="mt-5 rounded-xl border border-[var(--border)] bg-white p-4">
        <h3 className="font-semibold text-[var(--foreground)]">Thêm khoản phát sinh</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">Số tiền được cộng vào tổng dịch vụ hoặc phụ thu. Mô tả được lưu trong ghi chú đặt phòng.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(140px,0.8fr)_minmax(180px,1.5fr)_minmax(140px,0.8fr)_auto] md:items-end">
          <Field htmlFor="chargeKind" label="Loại khoản"><Select id="chargeKind" onChange={(event) => setChargeKind(event.target.value as typeof chargeKind)} value={chargeKind}><option value="serviceRevenue">Dịch vụ</option><option value="surchargeAmount">Phụ thu</option></Select></Field>
          <Field htmlFor="chargeDescription" label="Nội dung"><Input id="chargeDescription" maxLength={120} onChange={(event) => setChargeDescription(event.target.value)} placeholder="Ví dụ: giặt ủi" value={chargeDescription} /></Field>
          <Field htmlFor="chargeAmount" label="Số tiền"><MoneyInput id="chargeAmount" onChange={setChargeAmount} value={chargeAmount} /></Field>
          <Button onClick={addCharge}>Cộng khoản này</Button>
        </div>
        {chargeError ? <p className="mt-2 text-sm text-[var(--danger)]" role="alert">{chargeError}</p> : null}
      </div> : null}

      <Button
        aria-expanded={detailsOpen}
        className="mt-4 min-h-9 px-3"
        disabled={disabled}
        onClick={() => setDetailsOpen((current) => !current)}
        variant="secondary"
      >
        Chi tiết phí và giảm giá
        <ChevronDown className={`size-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
      </Button>

      {detailsOpen ? (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--sidebar)] p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900">Khoản phát sinh</h3>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Chỉ điền các khoản có phát sinh trong lần đặt phòng này.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {additionalMoneyFields.map((item) => (
              <Field error={fieldErrors[item.key]?.[0]} hint={booking && (item.key === "serviceRevenue" || item.key === "surchargeAmount") ? "Đây là tổng lũy kế; dùng Thêm khoản phát sinh ở trên để cộng nhanh." : undefined} htmlFor={item.key} key={item.key} label={item.label}>
                <MoneyInput disabled={disabled} id={item.key} onChange={(value) => updateField(item.key, value)} value={form[item.key]} />
              </Field>
            ))}
            <Field error={fieldErrors.discountReason?.[0]} htmlFor="discountReason" label="Lý do giảm giá" required={Number(form.discountAmount) > 0}>
              <Input disabled={disabled} id="discountReason" onChange={(event) => updateField("discountReason", event.target.value)} value={form.discountReason} />
            </Field>
            <Field htmlFor="promotionCode" label="Mã chương trình">
              <Input disabled={disabled} id="promotionCode" onChange={(event) => updateField("promotionCode", event.target.value)} value={form.promotionCode} />
            </Field>
            {!booking ? <div className="border-t border-slate-200 pt-4 md:col-span-2 xl:col-span-3">
              <p className="text-sm font-semibold text-slate-900">Tách nhiều phương thức thanh toán</p>
              <p className="mb-3 mt-0.5 text-xs text-slate-500">Dùng khi khách thanh toán bằng từ hai phương thức trở lên.</p>
              <div className="grid gap-4 md:grid-cols-3">
                {paymentFields.map((item) => (
                  <Field error={fieldErrors[item.key]?.[0]} htmlFor={`detail-${item.key}`} key={item.key} label={item.label}>
                    <MoneyInput disabled={disabled} id={`detail-${item.key}`} onChange={(value) => { updateField("paymentMethod", "split"); updateField(item.key, value); }} value={form[item.key]} />
                  </Field>
                ))}
              </div>
            </div> : null}
          </div>
        </div>
      ) : null}

      {booking ? <div className="mt-5 rounded-xl border border-[#bdd1cb] bg-[var(--nav-active)] p-4">
        <h3 className="font-semibold text-[var(--primary-strong)]">Quyết toán tạm tính</h3>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <PaymentValue label="Tổng đã lưu" value={summary.savedTotal ?? 0} valueClass="text-[var(--foreground)]" />
          <PaymentValue label="Chênh lệch đang sửa" value={summary.total - (summary.savedTotal ?? 0)} valueClass={summary.total >= (summary.savedTotal ?? 0) ? "text-[var(--primary)]" : "text-amber-800"} />
          <PaymentValue label="Tổng mới" value={summary.total} valueClass="text-[var(--primary)]" />
          <PaymentValue label="Đã thu thực tế" value={summary.recordedPaid} valueClass="text-emerald-800" />
          <PaymentValue label="Chuyển công nợ" value={summary.debt} valueClass="text-[#755b2e]" />
          <PaymentValue label={summary.balance < 0 ? "Cần xử lý dư" : "Còn cần thu"} value={Math.abs(summary.balance)} valueClass={summary.balance < 0 ? "text-red-700" : "text-amber-800"} />
        </div>
        {model.hasUnsavedChanges ? <p className="mt-3 text-xs font-medium text-[var(--primary-strong)]">Đây là số tạm tính. Lưu thay đổi trước khi ghi nhận khoản thu mới.</p> : null}
      </div> : null}

      {booking && !disabled && summary.balance > 0 ? <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-white p-3 text-sm"><span>Khách chưa trả ngay?</span><Button onClick={model.fillRemainingDebt} size="sm" variant="secondary">Điền {formatCurrency(summary.balance)} vào công nợ</Button>{model.hasUnsavedChanges ? <span className="text-[var(--muted)]">Kiểm tra rồi lưu thay đổi trước khi thu tiền.</span> : <a className="font-semibold text-[var(--primary)] underline underline-offset-2" href="#booking-payments">Đến phần thu tiền</a>}</div> : null}

      {booking && !disabled && summary.balance < 0 ? <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
        <h3 className="font-semibold text-amber-900">Tổng mới thấp hơn tiền đã thu và công nợ {formatCurrency(refundNeeded)}</h3>
        {summary.debt > 0 ? <div className="mt-3 flex flex-wrap items-center gap-2"><span>Giảm công nợ trước nếu khoản này chưa thực thu.</span><Button onClick={model.fillRemainingDebt} size="sm" variant="secondary">Điều chỉnh công nợ còn lại</Button></div> : null}
        {summary.total < summary.recordedPaid && summary.debt === 0 ? <div className="mt-4 space-y-3 border-t border-amber-200 pt-4">
          <p>Chỉ ghi nhận hoàn sau khi đã trả tiền cho khách. Chọn đúng phương thức và số tiền thực tế đã hoàn; thao tác lưu thay đổi và ghi dòng hoàn vào sổ cùng lúc.</p>
          <Button onClick={suggestRefundSplit} size="sm" variant="secondary">Gợi ý chia {formatCurrency(refundNeeded)} theo tiền đã thu</Button>
          <div className="grid gap-3 sm:grid-cols-3">{(["CASH", "CARD", "TRANSFER"] as const).filter((method) => paidByMethod[method] > 0).map((method) => <Field hint={`Đã thu: ${formatCurrency(paidByMethod[method])}`} htmlFor={`refund-${method}`} key={method} label={method === "CASH" ? "Hoàn tiền mặt" : method === "CARD" ? "Hoàn qua thẻ" : "Hoàn chuyển khoản"}><MoneyInput id={`refund-${method}`} onChange={(value) => { setRefundAmounts((current) => ({ ...current, [method]: value })); setConfirmRefund(false); }} value={refundAmounts[method]} /></Field>)}</div>
          <Field error={fieldErrors["refund.reason"]?.[0]} htmlFor="refundReason" label="Lý do hoàn" required><Input id="refundReason" maxLength={260} onChange={(event) => { setRefundReason(event.target.value); setConfirmRefund(false); }} value={refundReason} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">{(["CASH", "CARD", "TRANSFER"] as const).filter((method) => Number(refundAmounts[method]) > 0).map((method) => <Field error={fieldErrors["refund.referenceCode"]?.[0]} htmlFor={`refundReference-${method}`} key={method} label={`Mã giao dịch ${method === "CASH" ? "tiền mặt" : method === "CARD" ? "thẻ" : "chuyển khoản"} (nếu có)`}><Input id={`refundReference-${method}`} maxLength={100} onChange={(event) => setRefundReferences((current) => ({ ...current, [method]: event.target.value }))} value={refundReferences[method]} /></Field>)}</div>
          <p className="font-semibold">Đã nhập hoàn {formatCurrency(refundTotal)} / cần xử lý {formatCurrency(refundNeeded)}</p>
          {fieldErrors.refunds?.[0] ? <p className="text-[var(--danger)]">{fieldErrors.refunds[0]}</p> : null}
          {confirmRefund ? <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-amber-900">Bạn đã trả {formatCurrency(refundTotal)} cho khách?</p><Button disabled={!refundValid || model.saving} onClick={() => void submitRefund()}>{model.saving ? "Đang lưu…" : "Xác nhận đã hoàn và lưu"}</Button><Button onClick={() => setConfirmRefund(false)} variant="secondary">Quay lại</Button></div> : <Button disabled={!refundValid || model.saving} onClick={() => setConfirmRefund(true)}>Tiếp tục ghi nhận hoàn</Button>}
        </div> : <p className="mt-2 text-amber-900">Điều chỉnh công nợ trước. Nếu tổng mới vẫn thấp hơn tiền đã thu, biểu mẫu hoàn chênh lệch sẽ hiện ra.</p>}
      </div> : null}

      {booking?.status === "CHECKED_IN" && !disabled && summary.balance >= 0 ? <div className="mt-4 flex justify-end"><Button disabled={model.saving || model.checkingAvailability || model.invalidStayTime || !model.availableRoomIds || Boolean(model.availabilityError)} onClick={() => void model.submit()} type="button">{model.saving ? "Đang lưu…" : "Lưu thay đổi và cập nhật số dư"}</Button></div> : null}
      {booking?.status === "CHECKED_IN" && model.message ? <p className="mt-2 text-right text-sm font-semibold text-emerald-700" role="status">{model.message}</p> : null}
      {booking?.status === "CHECKED_IN" && model.error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{model.error}</p> : null}
      {!booking ? <PaymentLine gross={summary.gross} paid={summary.paid} roomCount={form.roomMode === "multiple" ? Math.max(1, Number(Boolean(form.roomId)) + form.additionalRoomIds.length) : 1} /> : null}
    </div>
  );
}

function getPaymentError(fieldErrors: Record<string, string[]>) {
  return fieldErrors.cashAmount?.[0] ?? fieldErrors.cardAmount?.[0] ?? fieldErrors.transferAmount?.[0];
}

function PaymentLine({ gross, paid, roomCount }: Readonly<{ gross: number; paid: number; roomCount: number }>) {
  return (
    <div className="mt-5 flex justify-end">
      <div className="grid w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--sidebar)] text-sm sm:w-auto sm:grid-cols-2 sm:divide-x sm:divide-[var(--border)]">
        <PaymentValue label={roomCount > 1 ? "Tổng tiền cả nhóm" : "Tổng tiền"} value={gross * roomCount} valueClass="text-[var(--primary)]" />
        <PaymentValue label={roomCount > 1 ? "Đã thu cả nhóm" : "Đã thu"} value={paid * roomCount} valueClass={paid > 0 ? "text-[#24544d]" : "text-[var(--foreground)]"} />
      </div>
    </div>
  );
}

function PaymentValue({ label, value, valueClass }: Readonly<{ label: string; value: number; valueClass: string }>) {
  return (
    <p className="flex items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-2.5 last:border-b-0 sm:justify-start sm:border-b-0">
      <span className="font-medium text-slate-600">{label}:</span>
      <strong className={`font-semibold tabular-nums ${valueClass}`}>{formatCurrency(value)}</strong>
    </p>
  );
}
