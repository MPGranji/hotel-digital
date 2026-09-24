import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { formFromBooking } from "./booking-form-state";
import type { useBookingForm } from "./use-booking-form";

type FormModel = ReturnType<typeof useBookingForm>;
type StatusAction = "check-in" | "check-out" | "no-show" | "cancel";

const actionLabels: Record<StatusAction, string> = {
  "check-in": "Nhận phòng",
  "check-out": "Trả phòng",
  "no-show": "Đánh dấu không đến",
  cancel: "Hủy đặt phòng",
};

function hotelNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}`;
}

export function BookingStatusControls({ model, readOnly }: Readonly<{ model: FormModel; readOnly: boolean }>) {
  const router = useRouter();
  const { booking, form, saving, changeStatus, discardChanges, moveStayToNow } = model;
  const [pendingAction, setPendingAction] = useState<StatusAction>();
  const [confirmClose, setConfirmClose] = useState(false);
  if (!booking) return null;

  const amountToCollect = Math.max(0, booking.previousDebt + booking.grossRevenue - booking.paidAmount - booking.debtAmount);
  const savedForm = formFromBooking(booking);
  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(savedForm);
  const active = booking.status === "BOOKED" || booking.status === "CHECKED_IN";
  const now = hotelNow();
  const stayHasPassed = booking.status === "BOOKED" && booking.checkOutAt <= now;
  const canCheckIn = booking.status === "BOOKED" && booking.checkInAt.slice(0, 10) <= now.slice(0, 10) && booking.checkOutAt > now;
  const needsTimeAdjustment = booking.status === "BOOKED" && !canCheckIn;
  const stayMovedToNow = needsTimeAdjustment && form.checkInAt !== savedForm.checkInAt && form.checkInAt <= now && form.checkOutAt > now;
  const blocked = saving || hasUnsavedChanges || model.remoteChangeAvailable;

  async function confirmAction() {
    if (!pendingAction || blocked || (pendingAction === "check-in" && !canCheckIn) || (pendingAction === "check-out" && amountToCollect > 0)) return;
    if (await changeStatus(pendingAction)) setPendingAction(undefined);
  }

  function closeEditing() {
    if (!booking) return;
    if (hasUnsavedChanges) {
      setConfirmClose(true);
      return;
    }
    setPendingAction(undefined);
    router.push(`/bookings?bookingId=${booking.id}&mode=view`);
  }

  function closeAndDiscard() {
    if (!booking) return;
    discardChanges();
    setConfirmClose(false);
    setPendingAction(undefined);
    router.push(`/bookings?bookingId=${booking.id}&mode=view`);
  }

  return <section aria-label="Xử lý trạng thái đặt phòng" className="mb-5 rounded-xl border border-[var(--border)] border-l-4 border-l-[var(--accent)] bg-white p-4 sm:p-5">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
      <div>
        <p className="text-sm font-bold text-[var(--primary-strong)]">Trạng thái đặt phòng</p>
        <div className="mt-2 flex flex-wrap items-center gap-3"><StatusBadge status={booking.status} /><span className="text-sm text-[var(--muted)]">Phòng {booking.roomNumber} · {formatDateTime(booking.checkInAt)} – {formatDateTime(booking.checkOutAt)}</span></div>
        {booking.status === "CHECKED_IN" && amountToCollect > 0 ? <p className="mt-2 text-sm text-[#8a5a2f]">Còn phải thu {formatCurrency(amountToCollect)} trước khi trả phòng. <a className="font-semibold underline underline-offset-2" href="#booking-payments">Đến Sổ thu tiền</a> để ghi nhận thu hoặc công nợ.</p> : null}
        {hasUnsavedChanges && !readOnly && active && !stayMovedToNow ? <p className="mt-2 text-sm text-[#8a5a2f]">Lưu các chỉnh sửa bên dưới trước khi đổi trạng thái.</p> : null}
        {!active ? <p className="mt-2 text-sm text-[var(--muted)]">Lượt này đã kết thúc; lịch sử booking vẫn được giữ lại.{(booking.status === "CANCELLED" || booking.status === "NO_SHOW") && booking.paidAmount > 0 ? <> Còn cọc cần xử lý: <a className="font-semibold text-[#8a5a2f] underline underline-offset-2" href="#booking-payments">{formatCurrency(booking.paidAmount)}</a>.</> : null}</p> : null}
      </div>
      {readOnly && active ? <Link className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--primary-strong)]" href={`/bookings?bookingId=${booking.id}`}>Mở xử lý trạng thái</Link> : null}
      {!readOnly && active ? <div className="flex shrink-0 flex-wrap gap-2">
        {!pendingAction && (booking.status === "BOOKED" ? <>
          <Button className="font-bold" disabled={blocked || !canCheckIn} onClick={() => setPendingAction("check-in")}>Xác nhận nhận phòng</Button>
          {booking.checkInAt < now ? <Button className="border-[#c9ad82] bg-[#fffaf2] font-semibold text-[#755b2e] hover:bg-[#f7ead5]" disabled={blocked} onClick={() => setPendingAction("no-show")} variant="secondary">Đánh dấu không đến</Button> : null}
          <Button className="bg-[#fff8f6] font-semibold" disabled={blocked} onClick={() => setPendingAction("cancel")} variant="danger">Hủy đặt phòng</Button>
        </> : <Button disabled={blocked || amountToCollect > 0} onClick={() => setPendingAction("check-out")}>Trả phòng · kết thúc lượt</Button>)}
        <Button className="font-semibold" disabled={saving} onClick={closeEditing} variant="ghost">Đóng xử lý</Button>
      </div> : null}
    </div>
    {needsTimeAdjustment && !readOnly ? <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${stayHasPassed ? "border-[#d8c6a7] bg-[#faf4e9] text-[#755b2e]" : "border-[#bdd1cb] bg-[var(--nav-active)] text-[var(--primary-strong)]"}`}>
      <div><p className="text-sm font-bold">{stayMovedToNow ? "Lịch mới chưa được lưu" : stayHasPassed ? "Lịch ở đã qua" : "Khách đến sớm hơn ngày đặt"}</p><p className="mt-0.5 text-sm">{stayMovedToNow ? "Kiểm tra giờ đi, phòng trống và tiền phòng bên dưới, rồi bấm Lưu thay đổi trước khi nhận phòng." : stayHasPassed ? "Nếu khách vừa đến, chuyển lịch về hiện tại rồi kiểm tra và lưu lại. Nếu khách không đến, dùng nút đánh dấu ở trên." : "Chuyển lịch về hiện tại nếu muốn nhận phòng sớm; kiểm tra và lưu lại trước khi nhận phòng."}</p></div>
      <Button className="shrink-0 border-[var(--border-strong)] bg-white font-bold text-[var(--primary-strong)] hover:bg-[var(--sidebar)]" disabled={saving} onClick={() => moveStayToNow(hotelNow().slice(0, 16))} variant="secondary">{stayMovedToNow ? "Cập nhật giờ hiện tại" : "Chuyển lịch về hiện tại"}</Button>
    </div> : null}
    {confirmClose ? <div className="mt-4 rounded-lg border border-[#d8c6a7] bg-[#faf4e9] p-4" role="group" aria-label="Đóng khi còn thay đổi chưa lưu">
      <p className="text-sm font-semibold text-[#755b2e]">Bạn có thay đổi chưa lưu. Bỏ thay đổi và đóng?</p>
      <div className="mt-3 flex flex-wrap gap-2"><Button onClick={closeAndDiscard} variant="secondary">Bỏ thay đổi và đóng</Button><Button onClick={() => setConfirmClose(false)} variant="ghost">Tiếp tục sửa</Button></div>
    </div> : null}
    {pendingAction && !confirmClose ? <div aria-label={`Xác nhận ${actionLabels[pendingAction]}`} className="mt-4 rounded-lg border border-[var(--border-strong)] bg-[var(--sidebar)] p-4" role="group">
      <p className="text-sm font-semibold text-[var(--foreground)]">{actionLabels[pendingAction]} cho {booking.bookingCode}?</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{pendingAction === "check-out" ? `Hóa đơn nháp sẽ được phát hành. Phòng vẫn giữ lịch đến ${formatDateTime(booking.checkOutAt)}; nếu khách đi sớm, sửa giờ đi và tiền phòng trước.` : pendingAction === "check-in" ? "Xác nhận khách đã đến và nhận phòng." : booking.paidAmount > 0 ? `Booking được giữ trong lịch sử. Cọc ${formatCurrency(booking.paidAmount)} sẽ chờ bạn xác nhận hoàn sau khi tự trả tiền cho khách.` : "Booking vẫn được giữ trong lịch sử để tra cứu."}</p>
      <div className="mt-3 flex flex-wrap gap-2"><Button disabled={blocked || (pendingAction === "check-in" && !canCheckIn) || (pendingAction === "check-out" && amountToCollect > 0)} onClick={() => void confirmAction()} variant={pendingAction === "cancel" || pendingAction === "no-show" ? "danger" : "primary"}>{saving ? "Đang xử lý…" : `Xác nhận ${actionLabels[pendingAction].toLowerCase()}`}</Button><Button disabled={saving} onClick={() => setPendingAction(undefined)} variant="secondary">Quay lại</Button></div>
    </div> : null}
  </section>;
}

export function OperationSection({ model, disabled }: Readonly<{ model: FormModel; disabled: boolean }>) {
  const { form, booking, fieldErrors, updateField } = model;

  return (
    <div>
      <SectionTitle>{booking ? "5. Ghi chú và chứng từ" : "4. Ghi chú và chứng từ"}</SectionTitle>
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
    </div>
  );
}
