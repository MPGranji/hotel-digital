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
  customerId: number | null;
  newCustomer: BookingCustomerInput | null;
  channelId: number;
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
  roomNumber: string;
  roomTypeName: string;
  customerName: string;
  channelName: string;
  status: string;
  paidAmount: number;
  grossRevenue: number;
  balanceDue: number;
  averageRoomRate: number;
  version: string;
}

export interface BookingListItem {
  id: number;
  bookingCode: string;
  roomNumber: string;
  roomTypeName: string;
  customerId: number;
  customerName: string;
  customerPhone?: string;
  channelId: number;
  channelName: string;
  checkInAt: string;
  checkOutAt: string;
  billedNights: number;
  roomRevenue: number;
  serviceRevenue: number;
  grossRevenue: number;
  paidAmount: number;
  debtAmount: number;
  balanceDue: number;
  status: string;
  version: string;
}

export interface BookingOptions {
  rooms: Array<{ id: number; roomNumber: string; roomTypeName: string; listedPricePerNight?: number }>;
  channels: Array<{ id: number; code: string; name: string; category: string }>;
}
