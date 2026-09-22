"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DataMessage, PageHeader, Panel } from "@/components/ui/page";
import { CustomerSection } from "./customer-section";
import { FinanceSection } from "./finance-section";
import { OperationSection } from "./operation-section";
import { PaymentSection } from "@/features/payments/payment-section";
import { StaySection } from "./stay-section";
import { useBookingForm } from "./use-booking-form";

export function BookingForm({ bookingId, initialRoomId, initialCheckInDate, initialCheckOutDate, readOnly = false }: Readonly<{ bookingId?: number; initialRoomId?: number; initialCheckInDate?: string; initialCheckOutDate?: string; readOnly?: boolean }>) {
  const model = useBookingForm(bookingId, initialRoomId, initialCheckInDate, initialCheckOutDate);
  const closed = readOnly
    || model.booking?.status === "CHECKED_OUT"
    || model.booking?.status === "CANCELLED"
    || model.booking?.status === "NO_SHOW";

  if (model.loading) {
    return <DataMessage title="Đang tải biểu mẫu đặt phòng…" />;
  }

  return (
    <>
      <PageHeader
        actions={readOnly && model.booking ? (
          <Link className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#d8c6a7] bg-[#faf4e9] px-4 py-2 text-sm font-medium text-[#755b2e] transition-colors hover:bg-[#f3ead8]" href={`/bookings?bookingId=${model.booking.id}`}>Sửa đặt phòng</Link>
        ) : <Button onClick={model.reset} variant="secondary">Tạo đặt phòng mới</Button>}
        description="Điền thông tin khách và thời gian lưu trú. Tiền phòng, khoản thu và hóa đơn sẽ đi cùng đặt phòng này."
        title={model.booking ? `${readOnly ? "Xem" : "Đặt phòng"} ${model.booking.bookingCode}` : "Tạo đặt phòng"}
      />
      <form onSubmit={(event) => { event.preventDefault(); void model.submit(); }}>
        <Panel className="space-y-7">
          {model.message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{model.message}</p> : null}
          {model.error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{model.error}</p> : null}
          <StaySection disabled={Boolean(closed)} model={model} />
          <CustomerSection disabled={Boolean(closed)} model={model} />
          <FinanceSection disabled={Boolean(closed)} model={model} />
          {readOnly ? <p className="rounded-lg border border-[#bdd1cb] bg-[var(--nav-active)] px-4 py-3 text-sm text-[var(--primary-strong)]">Bạn đang xem thông tin đặt phòng. Nhấn Sửa đặt phòng để thay đổi.</p> : null}
          <PaymentSection model={model} readOnly={readOnly} />
          <OperationSection disabled={Boolean(closed)} model={model} />
          {!closed ? (
            <div className="flex justify-end border-t border-slate-200 pt-5">
              <Button className="w-full md:w-auto" disabled={model.saving} type="submit">
                {model.saving ? "Đang lưu…" : model.booking ? "Lưu thay đổi" : model.form.entryMode === "WALK_IN" ? "Nhận phòng ngay" : model.form.entryMode === "ONLINE" ? "Lưu đặt phòng online" : "Lưu đặt phòng"}
              </Button>
            </div>
          ) : null}
        </Panel>
      </form>
    </>
  );
}
