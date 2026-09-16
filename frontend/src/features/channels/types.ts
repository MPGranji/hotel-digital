export type ChannelCategory = "DIRECT" | "OTA" | "PARTNER" | "INTERNAL" | "UNKNOWN";

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
