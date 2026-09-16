import { Field, Input } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/page";
import { formatCurrency } from "@/lib/format";
import type { BookingFormState } from "./booking-form-state";
import type { useBookingForm } from "./use-booking-form";

type FormModel = ReturnType<typeof useBookingForm>;
type MoneyField = keyof Pick<BookingFormState,
  "roomRevenue" | "serviceRevenue" | "surchargeAmount" | "discountAmount" | "previousDebt" |
  "cashAmount" | "cardAmount" | "transferAmount" | "debtAmount">;

const moneyFields: Array<{ key: MoneyField; label: string; required?: boolean }> = [
  { key: "roomRevenue", label: "Tiền phòng", required: true },
  { key: "serviceRevenue", label: "Dịch vụ" },
  { key: "surchargeAmount", label: "Phụ thu" },
  { key: "discountAmount", label: "Giảm giá" },
  { key: "previousDebt", label: "Nợ trước" },
  { key: "cashAmount", label: "Tiền mặt" },
  { key: "cardAmount", label: "Thẻ" },
  { key: "transferAmount", label: "Chuyển khoản" },
  { key: "debtAmount", label: "Chuyển công nợ" },
];

export function FinanceSection({ model, disabled }: Readonly<{ model: FormModel; disabled: boolean }>) {
  const { form, fieldErrors, summary, updateField } = model;

  return (
    <div>
      <SectionTitle>3. Doanh thu và thanh toán</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {moneyFields.map((item) => (
          <Field error={fieldErrors[item.key]?.[0]} htmlFor={item.key} key={item.key} label={item.label} required={item.required}>
            <Input disabled={disabled} id={item.key} min="0" onChange={(event) => updateField(item.key, event.target.value)} step="1000" type="number" value={form[item.key]} />
          </Field>
        ))}
        <Field error={fieldErrors.discountReason?.[0]} htmlFor="discountReason" label="Lý do giảm giá" required={Number(form.discountAmount) > 0}>
          <Input disabled={disabled} id="discountReason" onChange={(event) => updateField("discountReason", event.target.value)} value={form.discountReason} />
        </Field>
        <Field htmlFor="promotionCode" label="Mã chương trình">
          <Input disabled={disabled} id="promotionCode" onChange={(event) => updateField("promotionCode", event.target.value)} value={form.promotionCode} />
        </Field>
      </div>
      <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-blue-100 bg-blue-100 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Tổng doanh thu" value={summary.gross} />
        <Summary label="Đã thanh toán" value={summary.paid} />
        <Summary label="Còn thiếu" value={summary.balance} />
        <Summary label="Giá phòng trung bình / đêm" value={summary.averageRate} />
      </div>
    </div>
  );
}

function Summary({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="bg-blue-50 px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${value < 0 ? "text-red-700" : "text-[var(--primary)]"}`}>{formatCurrency(value)}</p>
    </div>
  );
}
