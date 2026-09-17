import { apiRequest } from "@/lib/api-client";
import type { ChannelItem, ChannelWriteRequest } from "./types";

const jsonHeaders = { "Content-Type": "application/json" };

export function getChannels(search = "", category = "", active = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (active) params.set("isActive", active);
  return apiRequest<ChannelItem[]>(`/api/channels?${params}`);
}

export function createChannel(request: ChannelWriteRequest) {
  return apiRequest<ChannelItem>("/api/channels", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(request),
  });
}

export function updateChannel(id: number, request: ChannelWriteRequest) {
  return apiRequest<ChannelItem>(`/api/channels/${id}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(request),
  });
}
