import { apiRequest } from "@/lib/api-client";
import type { PagedResult } from "@/types/api";
import type { CustomerDetail, CustomerDuplicateItem, CustomerListItem, CustomerStay, CustomerWriteRequest } from "./types";

const jsonHeaders = { "Content-Type": "application/json" };

export function getCustomers(search = "", page = 1, pageSize = 20, active = "true") {
  const params = new URLSearchParams({ search, page: String(page), pageSize: String(pageSize) });
  if (active) params.set("isActive", active);
  return apiRequest<PagedResult<CustomerListItem>>(`/api/customers?${params}`);
}

export function findCustomerDuplicates(request: Pick<CustomerWriteRequest, "fullName" | "phone" | "email" | "identityDocument">, excludeId?: number) {
  return apiRequest<CustomerDuplicateItem[]>("/api/customers/duplicates", {
    method: "POST", headers: jsonHeaders, body: JSON.stringify({ ...request, excludeId }),
  });
}

export function mergeCustomer(targetId: number, duplicateCustomerId: number) {
  return apiRequest<CustomerDetail>(`/api/customers/${targetId}/merge`, {
    method: "POST", headers: jsonHeaders, body: JSON.stringify({ duplicateCustomerId }),
  });
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
