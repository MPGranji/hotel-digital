"use client";

import { Button } from "@/components/ui/button";
import { DataMessage, PageHeader, Panel } from "@/components/ui/page";
import { CustomerSection } from "./customer-section";
import { FinanceSection } from "./finance-section";
import { OperationSection } from "./operation-section";
import { StaySection } from "./stay-section";
import { useBookingForm } from "./use-booking-form";

export function BookingForm({ bookingId, initialRoomId }: Readonly<{ bookingId?: number; initialRoomId?: number }>) {
  const model = useBookingForm(bookingId, initialRoomId);
  const closed = model.booking?.status === "CHECKED_OUT"
    || model.booking?.status === "CANCELLED"
    || model.booking?.status === "NO_SHOW";

  if (model.loading) {
    return <DataMessage title="Đang tải biểu mẫu đặt phòng…" />;
  }

  return (
    <>
      <PageHeader
        actions={<Button onClick={model.reset} variant="secondary">Tạo đặt phòng mới</Button>}
        description="Thông tin phòng, khách và thanh toán được lưu trong cùng một lượt. Các giá trị tổng hợp do hệ thống tính tự động."
        title={model.booking ? `Đặt phòng ${model.booking.bookingCode}` : "Tạo đặt phòng"}
      />
      <form onSubmit={(event) => { event.preventDefault(); void model.submit(); }}>
        <Panel className="space-y-7">
          {model.message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{model.message}</p> : null}
          {model.error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{model.error}</p> : null}
          <StaySection disabled={Boolean(closed)} model={model} />
          <CustomerSection disabled={Boolean(closed)} model={model} />
          <FinanceSection disabled={Boolean(closed)} model={model} />
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
