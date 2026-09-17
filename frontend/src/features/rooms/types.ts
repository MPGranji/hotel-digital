export interface RoomListItem {
  id: number;
  roomNumber: string;
  roomTypeId: number;
  roomTypeCode: string;
  roomTypeName: string;
  capacity: number;
  floorLabel?: string;
  listedPricePerNight?: number;
  isActive: boolean;
  countsTowardOccupancy: boolean;
  note?: string;
  bookingCount: number;
  status: "AVAILABLE" | "RESERVED" | "OCCUPIED" | "MAINTENANCE" | "INACTIVE";
  currentBookingId?: number;
  currentBookingCode?: string;
  currentGuestName?: string;
  nextCheckInAt?: string;
}

export interface RoomWriteRequest {
  roomNumber: string;
  roomTypeId: number;
  floorLabel: string;
  isActive: boolean;
  countsTowardOccupancy: boolean;
  note: string;
}

export interface RoomTypeItem {
  id: number;
  code: string;
  name: string;
  capacity: number;
  listedPricePerNight?: number;
  isActive: boolean;
  roomCount: number;
}

export interface RoomTypeWriteRequest {
  code: string;
  name: string;
  capacity: number;
  listedPricePerNight?: number;
  isActive: boolean;
}

export interface RoomRateItem {
  id: number;
  roomTypeId: number;
  roomTypeCode: string;
  roomTypeName: string;
  rateCode: "NET";
  effectiveFrom: string;
  effectiveTo?: string;
  weekdayPrice: number;
  weekendPrice: number;
  mondayPrice: number;
  tuesdayPrice: number;
  wednesdayPrice: number;
  thursdayPrice: number;
  fridayPrice: number;
  saturdayPrice: number;
  sundayPrice: number;
  isActive: boolean;
  note?: string;
  lastModifiedAtUtc: string;
  lastModifiedByDisplayName?: string;
  version: string;
}

export interface RoomRateHistoryItem {
  id: number;
  effectiveFrom: string;
  effectiveTo?: string;
  mondayPrice: number;
  tuesdayPrice: number;
  wednesdayPrice: number;
  thursdayPrice: number;
  fridayPrice: number;
  saturdayPrice: number;
  sundayPrice: number;
  isActive: boolean;
  note?: string;
  recordedFromUtc: string;
  recordedToUtc: string;
  isCurrent: boolean;
  lastModifiedAtUtc: string;
  lastModifiedByDisplayName?: string;
}

export interface RoomRateWriteRequest {
  roomTypeId: number;
  effectiveFrom: string;
  effectiveTo?: string;
  mondayPrice: number;
  tuesdayPrice: number;
  wednesdayPrice: number;
  thursdayPrice: number;
  fridayPrice: number;
  saturdayPrice: number;
  sundayPrice: number;
  isActive: boolean;
  note: string;
  version: string | null;
}

export interface RoomCalendarResponse {
  dateFrom: string;
  dateTo: string;
  dates: string[];
  rooms: RoomCalendarRow[];
}

export interface RoomCalendarRow {
  roomId: number;
  roomNumber: string;
  roomTypeName: string;
  floorLabel?: string;
  cells: RoomCalendarCell[];
}

export interface RoomCalendarCell {
  date: string;
  status: "AVAILABLE" | "BOOKED" | "CHECKED_IN" | "MAINTENANCE" | "INACTIVE";
  bookingId?: number;
  bookingCode?: string;
  customerName?: string;
  roomBlockId?: number;
  maintenanceReason?: string;
}

export interface RoomHourlyCalendarResponse {
  weekStart: string;
  weekEnd: string;
  roomId: number;
  roomNumber: string;
  roomTypeName: string;
  floorLabel?: string;
  isActive: boolean;
  dates: string[];
  events: RoomHourlyCalendarEvent[];
}

export interface RoomHourlyCalendarEvent {
  kind: "BOOKING" | "MAINTENANCE";
  status: string;
  startAt: string;
  endAt: string;
  bookingId?: number;
  bookingCode?: string;
  customerName?: string;
  roomBlockId?: number;
  maintenanceReason?: string;
}

export interface RoomBlockItem {
  id: number;
  roomId: number;
  roomNumber: string;
  startAt: string;
  endAt: string;
  reason: string;
  note?: string;
  isActive: boolean;
  version: string;
}

export interface RoomBlockWriteRequest {
  roomId: number;
  startAt: string;
  endAt: string;
  reason: string;
  note: string;
  isActive: boolean;
  version: string | null;
}
