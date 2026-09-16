import { toDateTimeLocal } from "@/lib/format";
import type { BookingDetail, BookingWriteRequest } from "./types";

export interface BookingFormState {
  roomId: string;
  channelId: string;
  externalBookingCode: string;
  checkInAt: string;
  checkOutAt: string;
  billedNights: string;
  customerMode: "existing" | "new";
  customerId: string;
  customerName: string;
  fullName: string;
  phone: string;
  email: string;
  identityDocument: string;
  nationality: string;
  customerNote: string;
  roomRevenue: string;
  serviceRevenue: string;
  surchargeAmount: string;
  discountAmount: string;
  discountReason: string;
  promotionCode: string;
  previousDebt: string;
  cashAmount: string;
  cardAmount: string;
  transferAmount: string;
  debtAmount: string;
  invoiceNumber: string;
  note: string;
  version: string | null;
}

export function createInitialBookingForm(): BookingFormState {
  const checkIn = new Date();
  checkIn.setMinutes(0, 0, 0);
  checkIn.setHours(Math.max(checkIn.getHours(), 14));
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 1);
  checkOut.setHours(12, 0, 0, 0);

  return {
    roomId: "",
    channelId: "",
    externalBookingCode: "",
    checkInAt: toDateTimeLocal(checkIn),
    checkOutAt: toDateTimeLocal(checkOut),
    billedNights: "1",
    customerMode: "existing",
    customerId: "",
    customerName: "",
    fullName: "",
    phone: "",
    email: "",
    identityDocument: "",
    nationality: "",
    customerNote: "",
    roomRevenue: "0",
    serviceRevenue: "0",
    surchargeAmount: "0",
    discountAmount: "0",
    discountReason: "",
    promotionCode: "",
    previousDebt: "0",
    cashAmount: "0",
    cardAmount: "0",
    transferAmount: "0",
    debtAmount: "0",
    invoiceNumber: "",
    note: "",
    version: null,
  };
}

export function formFromBooking(booking: BookingDetail): BookingFormState {
  return {
    roomId: String(booking.roomId),
    channelId: String(booking.channelId),
    externalBookingCode: booking.externalBookingCode ?? "",
    checkInAt: toDateTimeLocal(booking.checkInAt),
    checkOutAt: toDateTimeLocal(booking.checkOutAt),
    billedNights: String(booking.billedNights),
    customerMode: "existing",
    customerId: String(booking.customerId),
    customerName: booking.customerName,
    fullName: "",
    phone: "",
    email: "",
    identityDocument: "",
    nationality: "",
    customerNote: "",
    roomRevenue: String(booking.roomRevenue),
    serviceRevenue: String(booking.serviceRevenue),
    surchargeAmount: String(booking.surchargeAmount),
    discountAmount: String(booking.discountAmount),
    discountReason: booking.discountReason ?? "",
    promotionCode: booking.promotionCode ?? "",
    previousDebt: String(booking.previousDebt),
    cashAmount: String(booking.cashAmount),
    cardAmount: String(booking.cardAmount),
    transferAmount: String(booking.transferAmount),
    debtAmount: String(booking.debtAmount),
    invoiceNumber: booking.invoiceNumber ?? "",
    note: booking.note ?? "",
    version: booking.version,
  };
}

export function toBookingRequest(form: BookingFormState): BookingWriteRequest {
  return {
    roomId: Number(form.roomId),
    channelId: Number(form.channelId),
    externalBookingCode: form.externalBookingCode,
    checkInAt: form.checkInAt,
    checkOutAt: form.checkOutAt,
    billedNights: Number(form.billedNights),
    customerId: form.customerMode === "existing" ? Number(form.customerId) || null : null,
    newCustomer: form.customerMode === "new" ? {
      fullName: form.fullName,
      phone: form.phone,
      email: form.email,
      identityDocument: form.identityDocument,
      nationality: form.nationality,
      note: form.customerNote,
    } : null,
    roomRevenue: money(form.roomRevenue),
    serviceRevenue: money(form.serviceRevenue),
    surchargeAmount: money(form.surchargeAmount),
    discountAmount: money(form.discountAmount),
    discountReason: form.discountReason,
    promotionCode: form.promotionCode,
    previousDebt: money(form.previousDebt),
    cashAmount: money(form.cashAmount),
    cardAmount: money(form.cardAmount),
    transferAmount: money(form.transferAmount),
    debtAmount: money(form.debtAmount),
    invoiceNumber: form.invoiceNumber,
    note: form.note,
    version: form.version,
  };
}

export function calculateNights(checkInAt: string, checkOutAt: string) {
  const start = new Date(checkInAt);
  const end = new Date(checkOutAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return "1";
  return String(Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000)));
}

function money(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
