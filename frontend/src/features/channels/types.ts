export type ChannelCategory = "OFFLINE" | "ONLINE" | "TRAVEL_AGENCY";

export interface ChannelItem {
  id: number;
  code: string;
  name: string;
  category: ChannelCategory;
  isActive: boolean;
  note?: string;
  bookingCount: number;
}

export interface ChannelWriteRequest {
  code: string;
  name: string;
  category: ChannelCategory;
  isActive: boolean;
  note: string;
}
