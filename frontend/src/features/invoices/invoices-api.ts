import { apiRequest } from "@/lib/api-client";
import type { InvoiceItem, InvoiceWriteRequest } from "./types";

const jsonHeaders = { "Content-Type": "application/json" };

export function getInvoices(search = "", status = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  return apiRequest<InvoiceItem[]>(`/api/invoices?${params}`);
}

export function getInvoice(id: number) {
  return apiRequest<InvoiceItem>(`/api/invoices/${id}`);
}

export function createInvoice(request: InvoiceWriteRequest) {
  return apiRequest<InvoiceItem>("/api/invoices", { method: "POST", headers: jsonHeaders, body: JSON.stringify(request) });
}

export function updateInvoice(id: number, request: InvoiceWriteRequest) {
  return apiRequest<InvoiceItem>(`/api/invoices/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(request) });
}
