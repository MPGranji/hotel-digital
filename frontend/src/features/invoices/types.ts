export interface InvoiceItem {
  id: number;
  bookingId: number;
  bookingCode: string;
  customerName: string;
  roomNumber: string;
  invoiceNumber: string;
  issuedAt?: string;
  status: "DRAFT" | "ISSUED" | "VOID";
  grossAmount: number;
  paidAmount: number;
  debtAmount: number;
  balanceDue: number;
  note?: string;
  createdAt: string;
  version: string;
}

export interface InvoiceWriteRequest {
  bookingId: number;
  invoiceNumber: string;
  status: "DRAFT" | "ISSUED" | "VOID";
  note: string;
  version: string | null;
}
