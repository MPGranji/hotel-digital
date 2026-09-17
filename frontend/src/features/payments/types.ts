export type PaymentMethod = "CASH" | "CARD" | "TRANSFER";

export interface PaymentItem {
  id: number;
  bookingId: number;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  referenceCode?: string;
  note?: string;
  version: string;
}

export interface PaymentWriteRequest {
  amount: number;
  method: PaymentMethod;
  paidAt?: string;
  referenceCode: string;
  note: string;
}
