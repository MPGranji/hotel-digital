export interface CustomerListItem {
  id: number;
  fullName: string;
  phone?: string;
  email?: string;
  identityDocument?: string;
  nationality?: string;
  lastCheckInAt?: string;
  stayCount: number;
  version: string;
}

export interface CustomerDetail {
  id: number;
  fullName: string;
  phone?: string;
  email?: string;
  identityDocument?: string;
  nationality?: string;
  note?: string;
  createdAt: string;
  version: string;
}

export interface CustomerWriteRequest {
  fullName: string;
  phone: string;
  email: string;
  identityDocument: string;
  nationality: string;
  note: string;
  version: string | null;
}

export interface CustomerStay {
  bookingId: number;
  bookingCode: string;
  roomNumber: string;
  checkInAt: string;
  checkOutAt: string;
  status: string;
  grossRevenue: number;
}
