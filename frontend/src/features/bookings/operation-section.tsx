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
        <Field error={fieldErrors.note?.[0]} htmlFor="note" label="Ghi chú đặt phòng">
          <Textarea disabled={disabled} id="note" onChange={(event) => updateField("note", event.target.value)} rows={2} value={form.note} />
        </Field>
      </div>

      {booking?.invoiceId ? <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <span>Hóa đơn: <b className="text-[var(--primary)]">{booking.invoiceNumber}</b></span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${booking.invoiceStatus === "ISSUED" ? "bg-emerald-100 text-emerald-700" : booking.invoiceStatus === "VOID" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
          {booking.invoiceStatus === "ISSUED" ? "Đã phát hành" : booking.invoiceStatus === "VOID" ? "Đã hủy" : "Nháp"}
        </span>
        <Link className="font-semibold text-blue-700 hover:underline" href={`/invoices?invoiceId=${booking.invoiceId}`}>Xem hóa đơn</Link>
      </div> : form.invoiceNumber ? <p className="mt-3 text-sm text-slate-600">Số hóa đơn: <b className="text-[var(--primary)]">{form.invoiceNumber}</b></p> : null}

      {booking ? (
        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">Trạng thái hiện tại</span>
            <StatusBadge status={booking.status} />
          </div>
          {!disabled ? <div className="flex flex-wrap gap-2">
            {booking.status === "BOOKED" ? (
              <>
                <Button disabled={saving} onClick={() => void changeStatus("check-in")}>Nhận phòng</Button>
                <Button disabled={saving} onClick={() => confirmAndChange("no-show", "Xác nhận khách không đến?")} variant="secondary">Đánh dấu không đến</Button>
                <Button disabled={saving} onClick={() => confirmAndChange("cancel", "Hủy đặt phòng này? Lịch sử vẫn được giữ lại.")} variant="danger">Hủy đặt phòng</Button>
              </>
            ) : null}
            {booking.status === "CHECKED_IN" ? (
              <Button disabled={saving} onClick={() => confirmAndChange("check-out", "Xác nhận khách đã trả phòng?")}>Trả phòng</Button>
            ) : null}
          </div> : null}
        </div>
      ) : null}
    </div>
  );
}
import Link from "next/link";
