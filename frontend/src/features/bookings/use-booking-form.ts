"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiErrorMessage, getApiProblem } from "@/lib/api-client";
import { findCustomerDuplicates, getCustomers } from "@/features/customers/customers-api";
import type { CustomerDuplicateItem, CustomerListItem } from "@/features/customers/types";
import {
  changeBookingStatus,
  createBooking,
  getAvailableRoomIds,
  getBooking,
  getBookingOptions,
  updateBooking,
} from "./bookings-api";
import {
  calculateCheckOutAt,
  calculateNights,
  createInitialBookingForm,
  formFromBooking,
  toBookingRequest,
  type BookingFormState,
} from "./booking-form-state";
import { calculateSuggestedRoomRevenue } from "./booking-pricing";
import type { BookingDetail, BookingOptions } from "./types";

export function useBookingForm(bookingId?: number, initialRoomId?: number, initialCheckInDate?: string, initialCheckOutDate?: string) {
  const router = useRouter();
  const [form, setForm] = useState<BookingFormState>(createInitialBookingForm);
  const [booking, setBooking] = useState<BookingDetail>();
  const [options, setOptions] = useState<BookingOptions>({ rooms: [], channels: [] });
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [duplicateCustomers, setDuplicateCustomers] = useState<CustomerDuplicateItem[]>([]);
  const [duplicateCheckConfirmed, setDuplicateCheckConfirmed] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [availableRoomIds, setAvailableRoomIds] = useState<number[]>();
  const [checkingAvailability, setCheckingAvailability] = useState(true);
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
        if (!loadedBooking) {
          setForm((current) => {
            const defaultChannel = loadedOptions.channels.find((channel) => channel.code === "OFFLINE")
              ?? loadedOptions.channels.find((channel) => channel.category === "DIRECT")
              ?? loadedOptions.channels[0];
            const next = {
              ...current,
              channelId: current.channelId || (defaultChannel ? String(defaultChannel.id) : ""),
              roomId: initialRoomId && loadedOptions.rooms.some((room) => room.id === initialRoomId) ? String(initialRoomId) : current.roomId,
              checkInAt: initialCheckInDate ? `${initialCheckInDate}T14:00` : current.checkInAt,
              checkOutAt: initialCheckOutDate ? `${initialCheckOutDate}T12:00` : current.checkOutAt,
            };
            next.billedNights = calculateNights(next.checkInAt, next.checkOutAt);
            return next;
          });
        }
        if (loadedBooking) {
          setBooking(loadedBooking);
          setForm(formFromBooking(loadedBooking));
          setCustomerSearch(loadedBooking.customerName);
        }
      })
      .catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải biểu mẫu đặt phòng.")))
      .finally(() => setLoading(false));
    return () => { active = false; };
  }, [bookingId, initialCheckInDate, initialCheckOutDate, initialRoomId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getCustomers(customerSearch, 1, 20)
        .then((result) => setCustomers(result.items))
        .catch(() => setCustomers([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    if (bookingId || form.customerMode !== "new" || duplicateCheckConfirmed || !hasDuplicateSignal(form.phone, form.email, form.identityDocument)) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void findCustomerDuplicates({
        fullName: "",
        phone: form.phone,
        email: form.email,
        identityDocument: form.identityDocument,
      })
        .then((matches) => { if (active) setDuplicateCustomers(matches); })
        .catch(() => { /* Kiểm tra lại khi người dùng bấm lưu. */ });
    }, 450);
    return () => { active = false; window.clearTimeout(timer); };
  }, [bookingId, duplicateCheckConfirmed, form.customerMode, form.email, form.identityDocument, form.phone]);

  useEffect(() => {
    if (!form.checkInAt || !form.checkOutAt) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void getAvailableRoomIds(form.checkInAt, form.checkOutAt, bookingId)
        .then((ids) => {
          if (!active) return;
          setAvailableRoomIds(ids);
          setForm((current) => ({
            ...current,
            roomId: current.roomId && (ids.includes(Number(current.roomId)) || bookingId) ? current.roomId : "",
            additionalRoomIds: current.additionalRoomIds.filter((id) => ids.includes(Number(id))),
          }));
        })
        .catch(() => { if (active) setAvailableRoomIds([]); })
        .finally(() => { if (active) setCheckingAvailability(false); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [bookingId, form.checkInAt, form.checkOutAt]);

  const summary = useMemo(() => {
    const room = Number(form.roomRevenue) || 0;
    const service = Number(form.serviceRevenue) || 0;
    const surcharge = Number(form.surchargeAmount) || 0;
    const discount = Number(form.discountAmount) || 0;
    const paid = (Number(form.cashAmount) || 0) + (Number(form.cardAmount) || 0) + (Number(form.transferAmount) || 0);
    const gross = room + service + surcharge - discount;
    return {
      gross,
      paid,
      averageRate: gross >= 0 ? room / Math.max(Number(form.billedNights) || 1, 1) : 0,
    };
  }, [form]);

  function updateField<K extends keyof BookingFormState>(field: K, value: BookingFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    if (["fullName", "phone", "email", "identityDocument", "customerMode"].includes(field)) {
      setDuplicateCustomers([]);
      setDuplicateCheckConfirmed(false);
    }
    clearFieldErrors(field);
  }

  function clearFieldErrors(...fields: Array<keyof BookingFormState>) {
    setFieldErrors((current) => {
      if (!fields.some((field) => current[field])) return current;
      const next = { ...current };
      fields.forEach((field) => delete next[field]);
      return next;
    });
  }

  function updateStayDate(field: "checkInAt" | "checkOutAt", value: string) {
    setAvailableRoomIds(undefined);
    setCheckingAvailability(true);
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === "checkInAt" && new Date(next.checkOutAt) <= new Date(next.checkInAt)) {
        next.checkOutAt = calculateCheckOutAt(next.checkInAt, next.checkOutAt, next.billedNights);
      }

      next.billedNights = calculateNights(next.checkInAt, next.checkOutAt);
      return withSuggestedRoomRevenue(next);
    });
    clearFieldErrors(field, "billedNights");
  }

  function updateStayNights(value: string) {
    setAvailableRoomIds(undefined);
    setCheckingAvailability(true);
    setForm((current) => withSuggestedRoomRevenue({
      ...current,
      billedNights: value,
      checkOutAt: calculateCheckOutAt(current.checkInAt, current.checkOutAt, value),
    }));
    clearFieldErrors("billedNights", "checkOutAt");
  }

  function updateStayOption(field: "roomId" | "channelId", value: string) {
    setForm((current) => {
      const selectedChannel = field === "channelId"
        ? options.channels.find((channel) => String(channel.id) === value)
        : undefined;
      const directChannel = selectedChannel?.category === "DIRECT" || selectedChannel?.category === "INTERNAL";
      return withSuggestedRoomRevenue({
        ...current,
        [field]: value,
        roomRevenue: field === "channelId" && !directChannel ? "" : current.roomRevenue,
        externalBookingCode: directChannel ? "" : current.externalBookingCode,
        additionalRoomIds: field === "roomId" ? current.additionalRoomIds.filter((id) => id !== value) : current.additionalRoomIds,
      });
    });
    clearFieldErrors(field, "roomRevenue", "externalBookingCode");
  }

  function updateRoomMode(mode: "single" | "multiple") {
    setForm((current) => ({
      ...current,
      roomMode: mode,
      additionalRoomIds: mode === "single" ? [] : current.additionalRoomIds,
    }));
    clearFieldErrors("roomId", "additionalRoomIds");
  }

  function toggleRoom(roomId: string) {
    setForm((current) => {
      const selectedIds = [current.roomId, ...current.additionalRoomIds].filter(Boolean);
      const nextIds = selectedIds.includes(roomId)
        ? selectedIds.filter((id) => id !== roomId)
        : [...selectedIds, roomId];
      return withSuggestedRoomRevenue({
        ...current,
        roomId: nextIds[0] ?? "",
        additionalRoomIds: nextIds.slice(1),
      });
    });
    clearFieldErrors("roomId", "additionalRoomIds", "roomRevenue");
  }

  function withSuggestedRoomRevenue(next: BookingFormState) {
    const suggestedRevenue = calculateSuggestedRoomRevenue(next, options);
    return suggestedRevenue === undefined
      ? next
      : { ...next, roomRevenue: String(suggestedRevenue) };
  }

  async function refreshBooking() {
    if (!bookingId) return undefined;
    const loaded = await getBooking(bookingId);
    setBooking(loaded);
    setForm(formFromBooking(loaded));
    setCustomerSearch(loaded.customerName);
    return loaded;
  }

  async function submit() {
    setSaving(true);
    setError(undefined);
    setMessage(undefined);
    setFieldErrors({});
    try {
      if (!bookingId && form.customerMode === "new" && !duplicateCheckConfirmed) {
        const matches = await findCustomerDuplicates({
          fullName: form.fullName,
          phone: form.phone,
          email: form.email,
          identityDocument: form.identityDocument,
        });
        if (matches.length > 0) {
          setDuplicateCustomers(matches);
          setError("Có hồ sơ khách tương tự. Hãy chọn khách cũ hoặc xác nhận vẫn tạo hồ sơ mới.");
          return;
        }
      }
      const request = toBookingRequest(form);
      const saved = bookingId
        ? await updateBooking(bookingId, request)
        : await createBooking(request);
      setBooking(saved);
      setForm(formFromBooking(saved));
      setMessage(bookingId
        ? "Đã lưu thay đổi đặt phòng."
        : saved.groupCode
          ? `Đã tạo nhóm ${saved.groupCode} gồm ${form.additionalRoomIds.length + 1} phòng.`
          : `Đã tạo đặt phòng ${saved.bookingCode}.`);
      if (!bookingId) router.replace(`/bookings?bookingId=${saved.id}`);
    } catch (reason) {
      const problem = getApiProblem(reason);
      setFieldErrors(problem?.errors ?? {});
      setError(getApiErrorMessage(reason, "Không thể lưu đặt phòng. Vui lòng thử lại."));
    } finally {
      setSaving(false);
    }
  }

  function chooseDuplicateCustomer(customer: CustomerDuplicateItem) {
    setForm((current) => ({ ...current, customerMode: "existing", customerId: String(customer.id), customerName: customer.fullName }));
    setCustomerSearch(customer.fullName);
    setDuplicateCustomers([]);
    setDuplicateCheckConfirmed(false);
    setError(undefined);
  }

  function confirmNewCustomer() {
    setDuplicateCheckConfirmed(true);
    setDuplicateCustomers([]);
    setError(undefined);
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
    const defaultChannel = options.channels.find((channel) => channel.code === "OFFLINE")
      ?? options.channels.find((channel) => channel.category === "DIRECT")
      ?? options.channels[0];
    setForm({ ...createInitialBookingForm(), channelId: defaultChannel ? String(defaultChannel.id) : "" });
    setMessage(undefined);
    setError(undefined);
    setFieldErrors({});
  }

  return {
    form,
    booking,
    options,
    customers,
    duplicateCustomers,
    customerSearch,
    availableRoomIds,
    checkingAvailability,
    loading,
    saving,
    message,
    error,
    fieldErrors,
    summary,
    setCustomerSearch,
    chooseDuplicateCustomer,
    confirmNewCustomer,
    updateField,
    updateStayDate,
    updateStayNights,
    updateStayOption,
    updateRoomMode,
    toggleRoom,
    refreshBooking,
    submit,
    changeStatus,
    reset,
  };
}

function hasDuplicateSignal(phone: string, email: string, identityDocument: string) {
  const phoneDigits = phone.replace(/\D/g, "");
  return phoneDigits.length >= 8
    || email.trim().includes("@")
    || identityDocument.replace(/[^\p{L}\p{N}]/gu, "").length >= 6;
}
