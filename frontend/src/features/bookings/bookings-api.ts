import { apiRequest } from "@/lib/api-client";
import type { PagedResult } from "@/types/api";
import type { BookingDetail, BookingListItem, BookingOptions, BookingWriteRequest } from "./types";

const jsonHeaders = { "Content-Type": "application/json" };

export function getBookingOptions() {
  return apiRequest<BookingOptions>("/api/bookings/options");
}

export function getBooking(id: number) {
  return apiRequest<BookingDetail>(`/api/bookings/${id}`);
}

export function createBooking(request: BookingWriteRequest) {
  return apiRequest<BookingDetail>("/api/bookings", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(request),
  });
}

export function updateBooking(id: number, request: BookingWriteRequest) {
  return apiRequest<BookingDetail>(`/api/bookings/${id}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(request),
  });
}

export function deleteBooking(id: number, version: string) {
  return apiRequest<void>(`/api/bookings/${id}`, {
    method: "DELETE",
    headers: jsonHeaders,
    body: JSON.stringify({ version }),
  });
}

export function changeBookingStatus(id: number, action: string, version: string) {
  return apiRequest<BookingDetail>(`/api/bookings/${id}/${action}`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ version }),
  });
}

export function getAvailableRoomIds(checkInAt: string, checkOutAt: string, excludeBookingId?: number) {
  const params = new URLSearchParams({ checkInAt, checkOutAt });
  if (excludeBookingId) params.set("excludeBookingId", String(excludeBookingId));
  return apiRequest<number[]>(`/api/bookings/availability?${params}`);
}

export function getBookings(params: URLSearchParams) {
  return apiRequest<PagedResult<BookingListItem>>(`/api/bookings?${params}`);
}
