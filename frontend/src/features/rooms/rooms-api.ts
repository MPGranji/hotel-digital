import { apiRequest } from "@/lib/api-client";
import type { RoomBlockItem, RoomBlockWriteRequest, RoomCalendarResponse, RoomHourlyCalendarResponse, RoomListItem, RoomRateHistoryItem, RoomRateItem, RoomRateWriteRequest, RoomTypeItem, RoomTypeWriteRequest, RoomWriteRequest } from "./types";

const jsonHeaders = { "Content-Type": "application/json" };

export function getRooms(search = "", status = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  return apiRequest<RoomListItem[]>(`/api/rooms?${params}`);
}

export function createRoom(request: RoomWriteRequest) {
  return apiRequest<RoomListItem>("/api/rooms", { method: "POST", headers: jsonHeaders, body: JSON.stringify(request) });
}

export function updateRoom(id: number, request: RoomWriteRequest) {
  return apiRequest<RoomListItem>(`/api/rooms/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(request) });
}

export function getRoomTypes(active = "") {
  const params = new URLSearchParams();
  if (active) params.set("isActive", active);
  return apiRequest<RoomTypeItem[]>(`/api/room-types?${params}`);
}

export function createRoomType(request: RoomTypeWriteRequest) {
  return apiRequest<RoomTypeItem>("/api/room-types", { method: "POST", headers: jsonHeaders, body: JSON.stringify(request) });
}

export function updateRoomType(id: number, request: RoomTypeWriteRequest) {
  return apiRequest<RoomTypeItem>(`/api/room-types/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(request) });
}

export function getRoomRates(roomTypeId: number) {
  return apiRequest<RoomRateItem[]>(`/api/room-rates?roomTypeId=${roomTypeId}`);
}

export function getRoomRateHistory(id: number) {
  return apiRequest<RoomRateHistoryItem[]>(`/api/room-rates/${id}/history`);
}

export function createRoomRate(request: RoomRateWriteRequest) {
  return apiRequest<RoomRateItem>("/api/room-rates", { method: "POST", headers: jsonHeaders, body: JSON.stringify(request) });
}

export function updateRoomRate(id: number, request: RoomRateWriteRequest) {
  return apiRequest<RoomRateItem>(`/api/room-rates/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(request) });
}

export function getRoomCalendar(dateFrom: string, days: number) {
  const params = new URLSearchParams({ dateFrom, days: String(days) });
  return apiRequest<RoomCalendarResponse>(`/api/rooms/calendar?${params}`);
}

export function getRoomHourlyCalendar(roomId: number, weekStart: string) {
  const params = new URLSearchParams({ roomId: String(roomId), weekStart });
  return apiRequest<RoomHourlyCalendarResponse>(`/api/rooms/hourly-calendar?${params}`);
}

export function getRoomBlock(id: number) {
  return apiRequest<RoomBlockItem>(`/api/room-blocks/${id}`);
}

export function createRoomBlock(request: RoomBlockWriteRequest) {
  return apiRequest<RoomBlockItem>("/api/room-blocks", { method: "POST", headers: jsonHeaders, body: JSON.stringify(request) });
}

export function updateRoomBlock(id: number, request: RoomBlockWriteRequest) {
  return apiRequest<RoomBlockItem>(`/api/room-blocks/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(request) });
}
