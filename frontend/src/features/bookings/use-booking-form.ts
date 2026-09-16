"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiErrorMessage, getApiProblem } from "@/lib/api-client";
import { getCustomers } from "@/features/customers/customers-api";
import type { CustomerListItem } from "@/features/customers/types";
import {
  changeBookingStatus,
  createBooking,
  getAvailableRoomIds,
  getBooking,
  getBookingOptions,
  updateBooking,
} from "./bookings-api";
import {
  calculateNights,
  createInitialBookingForm,
  formFromBooking,
  toBookingRequest,
  type BookingFormState,
} from "./booking-form-state";
import type { BookingDetail, BookingOptions } from "./types";

export function useBookingForm(bookingId?: number) {
  const router = useRouter();
  const [form, setForm] = useState<BookingFormState>(createInitialBookingForm);
  const [booking, setBooking] = useState<BookingDetail>();
  const [options, setOptions] = useState<BookingOptions>({ rooms: [], channels: [] });
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [availableRoomIds, setAvailableRoomIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let active = true;
    Promise.all([getBookingOptions(), bookingId ? getBooking(bookingId) : Promise.resolve(undefined)])
      .then(([loadedOptions, loadedBooking]) => {
        if (!active) return;
        setOptions(loadedOptions);
        if (loadedBooking) {
          setBooking(loadedBooking);
          setForm(formFromBooking(loadedBooking));
          setCustomerSearch(loadedBooking.customerName);
        }
      })
      .catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải biểu mẫu đặt phòng.")))
      .finally(() => setLoading(false));
    return () => { active = false; };
  }, [bookingId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getCustomers(customerSearch, 1, 20)
        .then((result) => setCustomers(result.items))
        .catch(() => setCustomers([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    if (!form.checkInAt || !form.checkOutAt) return;
    const timer = window.setTimeout(() => {
      void getAvailableRoomIds(form.checkInAt, form.checkOutAt, bookingId)
        .then(setAvailableRoomIds)
        .catch(() => setAvailableRoomIds([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [bookingId, form.checkInAt, form.checkOutAt]);

  const summary = useMemo(() => {
    const room = Number(form.roomRevenue) || 0;
    const service = Number(form.serviceRevenue) || 0;
    const surcharge = Number(form.surchargeAmount) || 0;
    const discount = Number(form.discountAmount) || 0;
    const previousDebt = Number(form.previousDebt) || 0;
    const paid = (Number(form.cashAmount) || 0) + (Number(form.cardAmount) || 0) + (Number(form.transferAmount) || 0);
    const debt = Number(form.debtAmount) || 0;
    const gross = room + service + surcharge - discount;
    return {
      gross,
      paid,
      balance: previousDebt + gross - paid - debt,
      averageRate: gross >= 0 ? room / Math.max(Number(form.billedNights) || 1, 1) : 0,
    };
  }, [form]);

  function updateField<K extends keyof BookingFormState>(field: K, value: BookingFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateStayDate(field: "checkInAt" | "checkOutAt", value: string) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      next.billedNights = calculateNights(next.checkInAt, next.checkOutAt);
      return next;
    });
  }

  async function submit() {
    setSaving(true);
    setError(undefined);
    setMessage(undefined);
    setFieldErrors({});
    try {
      const request = toBookingRequest(form);
      const saved = bookingId
        ? await updateBooking(bookingId, request)
        : await createBooking(request);
      setBooking(saved);
      setForm(formFromBooking(saved));
      setMessage(bookingId ? "Đã lưu thay đổi đặt phòng." : `Đã tạo đặt phòng ${saved.bookingCode}.`);
      if (!bookingId) router.replace(`/bookings?bookingId=${saved.id}`);
    } catch (reason) {
      const problem = getApiProblem(reason);
      setFieldErrors(problem?.errors ?? {});
      setError(getApiErrorMessage(reason, "Không thể lưu đặt phòng. Vui lòng thử lại."));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(action: string) {
    if (!booking) return;
    setSaving(true);
    setError(undefined);
    try {
      const updated = await changeBookingStatus(booking.id, action, booking.version);
      setBooking(updated);
      setForm(formFromBooking(updated));
      setMessage("Đã cập nhật trạng thái đặt phòng.");
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Không thể cập nhật trạng thái đặt phòng."));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    router.replace("/bookings");
    setBooking(undefined);
    setForm(createInitialBookingForm());
    setMessage(undefined);
    setError(undefined);
    setFieldErrors({});
  }

  return {
    form,
    booking,
    options,
    customers,
    customerSearch,
    availableRoomIds,
    loading,
    saving,
    message,
    error,
    fieldErrors,
    summary,
    setCustomerSearch,
    updateField,
    updateStayDate,
    submit,
    changeStatus,
    reset,
  };
}
