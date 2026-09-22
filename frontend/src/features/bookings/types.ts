export interface BookingCustomerInput {
  fullName: string;
  phone: string;
  email: string;
  identityDocument: string;
  nationality: string;
  note: string;
}

export interface BookingWriteRequest {
  roomId: number;
  additionalRoomIds: number[];
  customerId: number | null;
  newCustomer: BookingCustomerInput | null;
  channelId: number;
  bookingMode: "RESERVATION" | "WALK_IN";
  externalBookingCode: string;
  checkInAt: string;
  checkOutAt: string;
  billedNights: number;
  roomRevenue: number;
  serviceRevenue: number;
  surchargeAmount: number;
  discountAmount: number;
  discountReason: string;
  promotionCode: string;
  previousDebt: number;
  cashAmount: number;
  cardAmount: number;
  transferAmount: number;
  debtAmount: number;
  invoiceNumber: string;
  note: string;
  version: string | null;
}

export interface BookingDetail extends Omit<BookingWriteRequest, "newCustomer"> {
  id: number;
  bookingCode: string;
  groupCode?: string;
  roomNumber: string;
  roomTypeName: string;
  customerName: string;
  channelName: string;
  channelCategory: string;
  status: string;
  paidAmount: number;
  grossRevenue: number;
  averageRoomRate: number;
  invoiceId?: number;
  invoiceStatus?: "DRAFT" | "ISSUED" | "VOID";
  version: string;
}

export interface BookingListItem {
  id: number;
  bookingCode: string;
  groupCode?: string;
  roomNumber: string;
  roomTypeName: string;
  customerId: number;
  customerName: string;
  customerPhone?: string;
  channelId: number;
  channelName: string;
  channelCategory: string;
  bookingMode: "RESERVATION" | "WALK_IN";
  invoiceId?: number;
  invoiceNumber?: string;
  invoiceStatus?: "DRAFT" | "ISSUED" | "VOID";
  checkInAt: string;
  checkOutAt: string;
  billedNights: number;
  roomRevenue: number;
  serviceRevenue: number;
  grossRevenue: number;
  paidAmount: number;
  debtAmount: number;
  status: string;
  version: string;
}

export interface BookingOptions {
  rooms: Array<{
    id: number;
    roomNumber: string;
    roomTypeCode: string;
    roomTypeName: string;
    capacity: number;
    listedPricePerNight?: number;
    rates: Array<{ code: string; weekdayPrice: number; weekendPrice: number; effectiveFrom?: string; effectiveTo?: string; mondayPrice?: number; tuesdayPrice?: number; wednesdayPrice?: number; thursdayPrice?: number; fridayPrice?: number; saturdayPrice?: number; sundayPrice?: number }>;
  }>;
  channels: Array<{ id: number; code: string; name: string; category: string }>;
}
