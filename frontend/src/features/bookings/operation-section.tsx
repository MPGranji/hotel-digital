import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
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
      <SectionTitle>4. Vận hành và ghi chú</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <Field error={fieldErrors.invoiceNumber?.[0]} htmlFor="invoiceNumber" label="Số hóa đơn">
          <Input disabled={disabled} id="invoiceNumber" onChange={(event) => updateField("invoiceNumber", event.target.value)} value={form.invoiceNumber} />
        </Field>
        <Field error={fieldErrors.note?.[0]} htmlFor="note" label="Ghi chú booking">
          <Textarea disabled={disabled} id="note" onChange={(event) => updateField("note", event.target.value)} rows={2} value={form.note} />
        </Field>
      </div>

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
