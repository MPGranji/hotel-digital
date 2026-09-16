import { apiRequest } from "@/lib/api-client";
import type { PagedResult } from "@/types/api";
import type { CustomerDetail, CustomerListItem, CustomerStay, CustomerWriteRequest } from "./types";

const jsonHeaders = { "Content-Type": "application/json" };

export function getCustomers(search = "", page = 1, pageSize = 20) {
  const params = new URLSearchParams({ search, page: String(page), pageSize: String(pageSize) });
  return apiRequest<PagedResult<CustomerListItem>>(`/api/customers?${params}`);
}

export function getCustomer(id: number) {
  return apiRequest<CustomerDetail>(`/api/customers/${id}`);
}

export function getCustomerStays(id: number) {
  return apiRequest<CustomerStay[]>(`/api/customers/${id}/stays`);
}

export function createCustomer(request: CustomerWriteRequest) {
  return apiRequest<CustomerDetail>("/api/customers", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(request),
  });
}

export function updateCustomer(id: number, request: CustomerWriteRequest) {
  return apiRequest<CustomerDetail>(`/api/customers/${id}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(request),
  });
}
