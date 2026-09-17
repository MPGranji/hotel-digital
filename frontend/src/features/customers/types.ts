export interface CustomerListItem {
  id: number;
  fullName: string;
  phone?: string;
  email?: string;
  identityDocument?: string;
  nationality?: string;
  isActive: boolean;
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
  isActive: boolean;
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
  isActive: boolean;
  version: string | null;
}

export interface CustomerDuplicateItem {
  id: number;
  fullName: string;
  phone?: string;
  email?: string;
  identityDocument?: string;
  matchStrength: "STRONG" | "POSSIBLE";
  matchedFields: string[];
  stayCount: number;
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
