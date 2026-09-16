export interface RoomListItem {
  id: number;
  roomNumber: string;
  roomTypeCode: string;
  roomTypeName: string;
  floorLabel?: string;
  listedPricePerNight?: number;
  status: "AVAILABLE" | "RESERVED" | "OCCUPIED" | "INACTIVE";
  currentBookingId?: number;
  currentBookingCode?: string;
  currentGuestName?: string;
  nextCheckInAt?: string;
}
