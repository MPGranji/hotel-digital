import { apiRequest } from "@/lib/api-client";
import type { PaymentItem, PaymentWriteRequest } from "./types";

const jsonHeaders = { "Content-Type": "application/json" };

export function getPayments(bookingId: number) {
  return apiRequest<PaymentItem[]>(`/api/bookings/${bookingId}/payments`);
}

export function createPayment(bookingId: number, request: PaymentWriteRequest) {
  return apiRequest<PaymentItem>(`/api/bookings/${bookingId}/payments`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(request),
  });
}
