import { apiRequest } from "@/lib/api-client";
import type { RoomListItem } from "./types";

export function getRooms(search = "", status = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  return apiRequest<RoomListItem[]>(`/api/rooms?${params}`);
}
