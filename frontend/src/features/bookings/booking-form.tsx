"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DataMessage, PageHeader, Panel } from "@/components/ui/page";
import { CustomerSection } from "./customer-section";
import { FinanceSection } from "./finance-section";
import { BookingStatusControls, OperationSection } from "./operation-section";
import { PaymentSection } from "@/features/payments/payment-section";
import { StaySection } from "./stay-section";
import { useBookingForm } from "./use-booking-form";

export function BookingForm({ bookingId, initialRoomId, initialCheckInDate, initialCheckOutDate, readOnly = false }: Readonly<{ bookingId?: number; initialRoomId?: number; initialCheckInDate?: string; initialCheckOutDate?: string; readOnly?: boolean }>) {
  const model = useBookingForm(bookingId, initialRoomId, initialCheckInDate, initialCheckOutDate);
  const scrolledTo = useRef<string | null>(null);
  const closed = readOnly
    || model.booking?.status === "CHECKED_OUT"
    || model.booking?.status === "CANCELLED"
    || model.booking?.status === "NO_SHOW";

  useEffect(() => {
    if (model.loading || !model.booking || !window.location.hash) return;
    const key = `${model.booking.id}:${window.location.hash}`;
    if (scrolledTo.current === key) return;
    const target = document.getElementById(window.location.hash.slice(1));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      scrolledTo.current = key;
    }
  }, [model.loading, model.booking]);

  if (model.loading) {
    return <DataMessage title="Đang tải biểu mẫu đặt phòng…" />;
  }

  if (model.initialLoadError) {
    return <DataMessage action={<Button onClick={model.retryInitialLoad}>Thử lại</Button>} description={model.initialLoadError} title="Chưa mở được đặt phòng" />;
  }

  return (
    <>
      <PageHeader
        actions={readOnly && model.booking ? (
          <Link className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#d8c6a7] bg-[#faf4e9] px-4 py-2 text-sm font-medium text-[#755b2e] transition-colors hover:bg-[#f3ead8]" href={`/bookings?bookingId=${model.booking.id}`}>Sửa đặt phòng</Link>
        ) : <Button onClick={model.reset} variant="secondary">Tạo đặt phòng mới</Button>}
        description={model.booking ? closed ? "Xem lại lịch sử lưu trú, chi phí và các khoản tiền đã ghi nhận." : "Cập nhật lịch ở, khoản phát sinh và tiền đã thu; các thay đổi sẽ đi cùng hóa đơn." : "Điền thông tin khách và thời gian lưu trú; tiền phòng, khoản thu và hóa đơn sẽ đi cùng đặt phòng này."}
        title={model.booking ? `${readOnly ? "Xem" : "Đặt phòng"} ${model.booking.bookingCode}` : "Tạo đặt phòng"}
      />
      <BookingStatusControls key={model.booking?.id ?? "new"} model={model} readOnly={readOnly} />
      <form className="booking-form" onSubmit={(event) => { event.preventDefault(); void model.submit(); }}>
        <Panel className="space-y-7">
          {model.message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{model.message}</p> : null}
          {model.error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{model.error}</p> : null}
          {model.remoteChangeAvailable ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status"><span>Đặt phòng này vừa được cập nhật ở nơi khác. Tải phiên bản mới trước khi thao tác tiếp.</span><Button onClick={() => { if (!model.hasUnsavedChanges || window.confirm("Tải phiên bản mới và bỏ các thay đổi chưa lưu trên biểu mẫu này?")) void model.acceptRemoteChanges(); }} type="button" variant="secondary">Tải phiên bản mới</Button></div> : null}
          <StaySection disabled={Boolean(closed)} model={model} />
          <CustomerSection disabled={Boolean(closed)} model={model} />
          <FinanceSection disabled={Boolean(closed)} model={model} />
          {readOnly ? <p className="rounded-lg border border-[#bdd1cb] bg-[var(--nav-active)] px-4 py-3 text-sm text-[var(--primary-strong)]">Bạn đang xem thông tin đặt phòng. Nhấn Sửa đặt phòng để thay đổi.</p> : null}
          <PaymentSection key={model.booking?.id ?? "new"} model={model} readOnly={readOnly} />
          <OperationSection disabled={Boolean(closed)} model={model} />
          {!closed ? (
            <div className="flex justify-end border-t border-slate-200 pt-5">
              <Button className="w-full md:w-auto" disabled={model.saving || model.checkingAvailability || model.invalidStayTime || !model.availableRoomIds || Boolean(model.availabilityError)} type="submit">
                {model.saving ? "Đang lưu…" : model.booking ? "Lưu thay đổi" : model.form.entryMode === "WALK_IN" ? "Nhận phòng ngay" : model.form.entryMode === "ONLINE" ? "Lưu đặt phòng online" : "Lưu đặt phòng"}
              </Button>
            </div>
          ) : null}
        </Panel>
      </form>
    </>
  );
}
