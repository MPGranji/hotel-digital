import { ApiError, apiRequest } from "@/lib/api-client";
import type { PagedResult } from "@/types/api";
import type { BookingDetail, BookingListItem, BookingOperationsSnapshot, BookingOptions, BookingRefundInput, BookingWriteRequest } from "./types";

const jsonHeaders = { "Content-Type": "application/json" };

export function getBookingOptions() {
  return apiRequest<BookingOptions>("/api/bookings/options");
}

let externalCodesEndpointAvailable = true;

export async function getExternalBookingCodes(channelId: number, search: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ channelId: String(channelId), search });
  if (externalCodesEndpointAvailable) {
    try {
      return await apiRequest<string[]>(`/api/bookings/external-codes?${params}`, { signal });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      externalCodesEndpointAvailable = false;
    }
  }

  // The web and API deploy separately. Use the existing booking reads until the API is updated.
  const bookingParams = new URLSearchParams({ channelId: String(channelId), page: "1", pageSize: search ? "20" : "12" });
  if (search) bookingParams.set("search", search);
  const page = await apiRequest<PagedResult<BookingListItem>>(`/api/bookings?${bookingParams}`, { signal });
  const codes = new Set<string>();
  for (let index = 0; index < page.items.length; index += 4) {
    const details = await Promise.all(page.items.slice(index, index + 4).map((booking) =>
      getBooking(booking.id, signal)));
    for (const booking of details) {
      if (booking.externalBookingCode?.toLocaleLowerCase("vi-VN").includes(search.toLocaleLowerCase("vi-VN")))
        codes.add(booking.externalBookingCode);
    }
  }
  return [...codes];
}

export function getBooking(id: number, signal?: AbortSignal) {
  return apiRequest<BookingDetail>(`/api/bookings/${id}`, { signal });
}

export function getBookingOperations() {
  return apiRequest<BookingOperationsSnapshot>("/api/bookings/operations");
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

export function adjustBookingAndRefund(id: number, booking: BookingWriteRequest, refunds: BookingRefundInput[]) {
  return apiRequest<BookingDetail>(`/api/bookings/${id}/adjust-and-refund`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ booking, refunds }),
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

export function getAvailableRoomIds(checkInAt: string, checkOutAt: string, excludeBookingId?: number, signal?: AbortSignal) {
  const params = new URLSearchParams({ checkInAt, checkOutAt });
  if (excludeBookingId) params.set("excludeBookingId", String(excludeBookingId));
  return apiRequest<number[]>(`/api/bookings/availability?${params}`, { signal });
}

export function getBookings(params: URLSearchParams) {
  return apiRequest<PagedResult<BookingListItem>>(`/api/bookings?${params}`);
}
