import { toDateTimeLocal } from "@/lib/format";
import { VIETNAM_NATIONALITY } from "./country-options";
import type { BookingDetail, BookingWriteRequest } from "./types";

export type PaymentMethod = "unpaid" | "cashAmount" | "cardAmount" | "transferAmount" | "split";

export interface BookingFormState {
  roomMode: "single" | "multiple";
  roomId: string;
  additionalRoomIds: string[];
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
  paymentMethod: PaymentMethod;
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
    roomMode: "single",
    roomId: "",
    additionalRoomIds: [],
    channelId: "",
    externalBookingCode: "",
    checkInAt: toDateTimeLocal(checkIn),
    checkOutAt: toDateTimeLocal(checkOut),
    billedNights: "1",
    customerMode: "new",
    customerId: "",
    customerName: "",
    fullName: "",
    phone: "",
    email: "",
    identityDocument: "",
    nationality: VIETNAM_NATIONALITY,
    customerNote: "",
    roomRevenue: "0",
    serviceRevenue: "0",
    surchargeAmount: "0",
    discountAmount: "0",
    discountReason: "",
    promotionCode: "",
    previousDebt: "0",
    paymentMethod: "cashAmount",
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
    roomMode: "single",
    roomId: String(booking.roomId),
    additionalRoomIds: [],
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
    paymentMethod: paymentMethodFromAmounts(booking),
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
    additionalRoomIds: form.roomMode === "multiple" ? form.additionalRoomIds.map(Number) : [],
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

export function calculateCheckOutAt(checkInAt: string, currentCheckOutAt: string, billedNights: string) {
  const start = new Date(checkInAt);
  const currentEnd = new Date(currentCheckOutAt);
  const nights = Number(billedNights);

  if (Number.isNaN(start.getTime()) || !Number.isInteger(nights) || nights < 1) {
    return currentCheckOutAt;
  }

  const end = new Date(start);
  end.setDate(end.getDate() + nights);

  if (Number.isNaN(currentEnd.getTime())) {
    end.setHours(12, 0, 0, 0);
  } else {
    end.setHours(currentEnd.getHours(), currentEnd.getMinutes(), 0, 0);
  }

  return toDateTimeLocal(end);
}

function money(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function paymentMethodFromAmounts(amounts: Pick<BookingDetail, "cashAmount" | "cardAmount" | "transferAmount">): PaymentMethod {
  const methods = (["cashAmount", "cardAmount", "transferAmount"] as const)
    .filter((key) => amounts[key] > 0);
  if (methods.length > 1) return "split";
  return methods[0] ?? "unpaid";
}
