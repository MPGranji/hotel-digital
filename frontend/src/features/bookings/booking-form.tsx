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
          <Link className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline focus-visible:outline-2" href={`/bookings?bookingId=${model.booking.id}`}>Sửa đặt phòng</Link>
        ) : <Button onClick={model.reset} variant="secondary">Tạo đặt phòng mới</Button>}
        description="Thông tin phòng, khách và thanh toán được lưu trong cùng một lượt. Các giá trị tổng hợp do hệ thống tính tự động."
        title={model.booking ? `${readOnly ? "Xem" : "Đặt phòng"} ${model.booking.bookingCode}` : "Tạo đặt phòng"}
      />
      <form onSubmit={(event) => { event.preventDefault(); void model.submit(); }}>
        <Panel className="space-y-7">
          {model.message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{model.message}</p> : null}
          {model.error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{model.error}</p> : null}
          <StaySection disabled={Boolean(closed)} model={model} />
          <CustomerSection disabled={Boolean(closed)} model={model} />
          <FinanceSection disabled={Boolean(closed)} model={model} />
          {readOnly ? <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Bạn đang xem ở chế độ chỉ đọc.</p> : null}
          <PaymentSection model={model} readOnly={readOnly} />
          <OperationSection disabled={Boolean(closed)} model={model} />
          {!closed ? (
            <div className="flex justify-end border-t border-slate-200 pt-5">
              <Button className="w-full md:w-auto" disabled={model.saving} type="submit">
                {model.saving ? "Đang lưu…" : model.booking ? "Lưu thay đổi" : "Lưu đặt phòng"}
              </Button>
            </div>
          ) : null}
        </Panel>
      </form>
    </>
  );
}
