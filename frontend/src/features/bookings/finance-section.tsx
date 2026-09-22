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
  const selectedChannel = options.channels.find((channel) => String(channel.id) === form.channelId);
  const usesCounterRate = selectedChannel?.category === "OFFLINE";
  const paymentMethod = form.paymentMethod;
  const hasAdditionalDetails = additionalMoneyFields.some(({ key }) => Number(form[key]) > 0)
    || Boolean(form.discountReason || form.promotionCode)
    || (!booking && paymentMethod === "split");
  const [detailsOpen, setDetailsOpen] = useState(hasAdditionalDetails);

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
    <div>
      <SectionTitle>3. Giá phòng và thanh toán</SectionTitle>
      <div className={`grid gap-4 ${booking ? "max-w-2xl" : "md:grid-cols-3"}`}>
        <Field error={fieldErrors.roomRevenue?.[0]} hint={usesCounterRate ? "Tự tính theo bảng giá tại quầy; bạn vẫn có thể điều chỉnh." : "Nhập tiền phòng theo giá của kênh đặt."} htmlFor="roomRevenue" label="Tiền phòng" required>
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
        {!booking ? <Field error={getPaymentError(fieldErrors)} hint={paymentMethod === "split" ? "Xem chi tiết từng phương thức bên dưới." : undefined} htmlFor="paidAmount" label="Tiền cọc đã thu">
          <MoneyInput disabled={disabled || paymentMethod === "unpaid" || paymentMethod === "split"} id="paidAmount" onChange={changePaidAmount} value={String(summary.paid)} />
        </Field> : null}
      </div>

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
            <h3 className="text-sm font-semibold text-slate-900">Khoản phát sinh</h3>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Chỉ điền các khoản có phát sinh trong lần đặt phòng này.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {additionalMoneyFields.map((item) => (
              <Field error={fieldErrors[item.key]?.[0]} htmlFor={item.key} key={item.key} label={item.label}>
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

      {booking ? <p className="mt-4 rounded-lg border border-[#bdd1cb] bg-[var(--nav-active)] px-4 py-3 text-sm text-[var(--primary-strong)]">Khoản đã thu được lấy từ sổ thu tiền bên dưới và giữ nguyên khi bạn sửa thông tin đặt phòng.</p> : null}
      {!booking ? <PaymentLine gross={summary.gross} paid={summary.paid} /> : null}
    </div>
  );
}

function getPaymentError(fieldErrors: Record<string, string[]>) {
  return fieldErrors.cashAmount?.[0] ?? fieldErrors.cardAmount?.[0] ?? fieldErrors.transferAmount?.[0];
}

function PaymentLine({ gross, paid }: Readonly<{ gross: number; paid: number }>) {
  return (
    <div className="mt-5 flex justify-end">
      <div className="grid w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--sidebar)] text-sm sm:w-auto sm:grid-cols-2 sm:divide-x sm:divide-[var(--border)]">
        <PaymentValue label="Tổng tiền" value={gross} valueClass="text-[var(--primary)]" />
        <PaymentValue label="Đã thu" value={paid} valueClass={paid > 0 ? "text-[#24544d]" : "text-[var(--foreground)]"} />
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
