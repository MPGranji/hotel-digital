import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import type { useBookingForm } from "./use-booking-form";

type FormModel = ReturnType<typeof useBookingForm>;

export function OperationSection({ model, disabled }: Readonly<{ model: FormModel; disabled: boolean }>) {
  const { form, booking, fieldErrors, saving, updateField, changeStatus } = model;

  function confirmAndChange(action: string, message: string) {
    if (window.confirm(message)) void changeStatus(action);
  }

  return (
    <div>
      <SectionTitle>5. Vận hành và ghi chú</SectionTitle>
      <div>
        <Field error={fieldErrors.note?.[0]} htmlFor="note" label="Ghi chú booking">
          <Textarea disabled={disabled} id="note" onChange={(event) => updateField("note", event.target.value)} rows={2} value={form.note} />
        </Field>
      </div>

      {form.invoiceNumber ? <p className="mt-3 text-sm text-slate-600">Số hóa đơn: <b className="text-[var(--primary)]">{form.invoiceNumber}</b></p> : null}

      {booking ? (
        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">Trạng thái hiện tại</span>
            <StatusBadge status={booking.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {booking.status === "BOOKED" ? (
              <>
                <Button disabled={saving} onClick={() => void changeStatus("check-in")}>Check-in</Button>
                <Button disabled={saving} onClick={() => confirmAndChange("no-show", "Xác nhận khách không đến?")} variant="secondary">Đánh dấu không đến</Button>
                <Button disabled={saving} onClick={() => confirmAndChange("cancel", "Hủy đặt phòng này? Lịch sử vẫn được giữ lại.")} variant="danger">Hủy đặt phòng</Button>
              </>
            ) : null}
            {booking.status === "CHECKED_IN" ? (
              <Button disabled={saving} onClick={() => confirmAndChange("check-out", "Xác nhận khách đã trả phòng?")}>Check-out</Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
