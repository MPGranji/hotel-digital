"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiErrorMessage, getApiProblem } from "@/lib/api-client";
import { toDateTimeLocal } from "@/lib/format";
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
  type BookingEntryMode,
  type BookingFormState,
} from "./booking-form-state";
import { calculateSuggestedRoomRevenue } from "./booking-pricing";
import type { BookingDetail, BookingOptions } from "./types";

function getDefaultChannel(channels: BookingOptions["channels"]) {
  return channels.find((channel) => channel.code === "DIRECT")
    ?? channels.find((channel) => channel.category === "OFFLINE")
    ?? channels[0];
}

function getOnlineChannel(channels: BookingOptions["channels"]) {
  return channels.find((channel) => channel.category === "ONLINE");
}

export function useBookingForm(bookingId?: number, initialRoomId?: number, initialCheckInDate?: string, initialCheckOutDate?: string) {
  const router = useRouter();
  const [form, setForm] = useState<BookingFormState>(createInitialBookingForm);
  const [booking, setBooking] = useState<BookingDetail>();
  const [options, setOptions] = useState<BookingOptions>({ rooms: [], channels: [] });
  const [customerSearchResult, setCustomerSearchResult] = useState<{ key: string; items?: CustomerListItem[]; error?: string }>();
  const [customerSearchReloadKey, setCustomerSearchReloadKey] = useState(0);
  const [duplicateCustomers, setDuplicateCustomers] = useState<CustomerDuplicateItem[]>([]);
  const [duplicateCheckConfirmed, setDuplicateCheckConfirmed] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [availability, setAvailability] = useState<{ key: string; ids?: number[]; error?: string }>();
  const [availabilityReloadKey, setAvailabilityReloadKey] = useState(0);
  const [initialLoadError, setInitialLoadError] = useState<string>();
  const [formReloadKey, setFormReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const customerSearchKey = `${customerSearch}|${customerSearchReloadKey}`;
  const currentCustomerSearch = customerSearchResult?.key === customerSearchKey ? customerSearchResult : undefined;
  const customers = currentCustomerSearch?.items ?? [];
  const customerSearchError = currentCustomerSearch?.error;
  const checkingCustomerSearch = form.customerMode === "existing" && !currentCustomerSearch;
  const availabilityKey = `${form.checkInAt}|${form.checkOutAt}|${bookingId ?? "new"}|${availabilityReloadKey}`;
  const checkInTime = new Date(form.checkInAt).getTime();
  const checkOutTime = new Date(form.checkOutAt).getTime();
  const invalidStayTime = Boolean(form.checkInAt && form.checkOutAt)
    && (!Number.isFinite(checkInTime) || !Number.isFinite(checkOutTime) || checkOutTime <= checkInTime);
  const canCheckAvailability = Boolean(form.checkInAt && form.checkOutAt) && !invalidStayTime;
  const currentAvailability = availability?.key === availabilityKey ? availability : undefined;
  const availableRoomIds = currentAvailability?.ids;
  const availabilityError = currentAvailability?.error;
  const checkingAvailability = canCheckAvailability && !currentAvailability;

  useEffect(() => {
    let active = true;
    Promise.all([getBookingOptions(), bookingId ? getBooking(bookingId) : Promise.resolve(undefined)])
      .then(([loadedOptions, loadedBooking]) => {
        if (!active) return;
        setOptions(loadedOptions);
        if (!loadedBooking) {
          setForm((current) => {
            const defaultChannel = getDefaultChannel(loadedOptions.channels);
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
      .catch((reason) => { if (active) setInitialLoadError(getApiErrorMessage(reason, "Không thể tải biểu mẫu đặt phòng.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingId, formReloadKey, initialCheckInDate, initialCheckOutDate, initialRoomId]);

  useEffect(() => {
    if (form.customerMode !== "existing") return;
    let active = true;
    const timer = window.setTimeout(() => {
      void getCustomers(customerSearch, 1, 20)
        .then((result) => { if (active) setCustomerSearchResult({ key: customerSearchKey, items: result.items }); })
        .catch((reason) => { if (active) setCustomerSearchResult({ key: customerSearchKey, error: getApiErrorMessage(reason, "Không thể tìm khách hàng.") }); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [customerSearch, customerSearchKey, form.customerMode]);

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
    if (!canCheckAvailability) return;
    let active = true;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    const timer = window.setTimeout(() => {
      void getAvailableRoomIds(form.checkInAt, form.checkOutAt, bookingId, signal)
        .then((ids) => {
          if (!active) return;
          setAvailability({ key: availabilityKey, ids });
          setForm((current) => ({
            ...current,
            roomId: current.roomId && ids.includes(Number(current.roomId)) ? current.roomId : "",
            additionalRoomIds: current.additionalRoomIds.filter((id) => ids.includes(Number(id))),
          }));
        })
        .catch((reason) => { if (active) setAvailability({ key: availabilityKey, error: getApiErrorMessage(reason, "Không thể kiểm tra phòng trống.") }); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [availabilityKey, bookingId, canCheckAvailability, form.checkInAt, form.checkOutAt]);

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
    setMessage(undefined);
    setError(undefined);
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
    setMessage(undefined);
    setError(undefined);
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === "checkInAt" && new Date(next.checkOutAt) <= new Date(next.checkInAt)) {
        next.checkOutAt = calculateCheckOutAt(next.checkInAt, next.checkOutAt, next.billedNights);
      }

      next.billedNights = calculateNights(next.checkInAt, next.checkOutAt);
      return withSuggestedRoomRevenue(next);
    });
    clearFieldErrors("checkInAt", "checkOutAt", "billedNights");
  }

  function updateStayNights(value: string) {
    setMessage(undefined);
    setError(undefined);
    setForm((current) => withSuggestedRoomRevenue({
      ...current,
      billedNights: value,
      checkOutAt: calculateCheckOutAt(current.checkInAt, current.checkOutAt, value),
    }));
    clearFieldErrors("billedNights", "checkOutAt");
  }

  function updateStayOption(field: "roomId" | "channelId", value: string) {
    setMessage(undefined);
    setError(undefined);
    setForm((current) => {
      const selectedChannel = field === "channelId"
        ? options.channels.find((channel) => String(channel.id) === value)
        : undefined;
      const directChannel = selectedChannel?.category === "OFFLINE";
      return withSuggestedRoomRevenue({
        ...current,
        [field]: value,
        entryMode: field === "channelId" && current.entryMode !== "WALK_IN"
          ? selectedChannel?.category === "ONLINE" ? "ONLINE" : "ADVANCE"
          : current.entryMode,
        roomRevenue: field === "channelId" && !directChannel ? "" : current.roomRevenue,
        externalBookingCode: directChannel ? "" : current.externalBookingCode,
        additionalRoomIds: field === "roomId" ? current.additionalRoomIds.filter((id) => id !== value) : current.additionalRoomIds,
      });
    });
    clearFieldErrors(field, "roomRevenue", "externalBookingCode");
  }

  function updateEntryMode(entryMode: BookingEntryMode) {
    const channel = entryMode === "ONLINE"
      ? getOnlineChannel(options.channels)
      : getDefaultChannel(options.channels);
    const walkInCheckIn = new Date();
    walkInCheckIn.setSeconds(0, 0);
    const walkInCheckOut = new Date(walkInCheckIn);
    walkInCheckOut.setDate(walkInCheckOut.getDate() + 1);
    walkInCheckOut.setHours(12, 0, 0, 0);
    setMessage(undefined);
    setError(undefined);
    setForm((current) => withSuggestedRoomRevenue({
      ...current,
      entryMode,
      channelId: channel ? String(channel.id) : "",
      externalBookingCode: entryMode === "ONLINE" ? current.externalBookingCode : "",
      checkInAt: entryMode === "WALK_IN" ? toDateTimeLocal(walkInCheckIn) : current.checkInAt,
      checkOutAt: entryMode === "WALK_IN" ? toDateTimeLocal(walkInCheckOut) : current.checkOutAt,
      billedNights: entryMode === "WALK_IN" ? "1" : current.billedNights,
    }));
    clearFieldErrors("channelId", "externalBookingCode", "checkInAt", "checkOutAt", "billedNights");
  }

  function updateRoomMode(mode: "single" | "multiple") {
    setMessage(undefined);
    setError(undefined);
    setForm((current) => ({
      ...current,
      roomMode: mode,
      additionalRoomIds: mode === "single" ? [] : current.additionalRoomIds,
    }));
    clearFieldErrors("roomId", "additionalRoomIds");
  }

  function toggleRoom(roomId: string) {
    setMessage(undefined);
    setError(undefined);
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
          ? `Đã tạo nhóm ${saved.groupCode} gồm ${form.additionalRoomIds.length + 1} phòng và hóa đơn nháp.`
          : `${saved.bookingMode === "WALK_IN" ? "Đã nhận phòng" : "Đã tạo đặt phòng"} ${saved.bookingCode} và hóa đơn nháp ${saved.invoiceNumber ?? ""}.`);
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
    setMessage(undefined);
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
    const defaultChannel = getDefaultChannel(options.channels);
    setForm({ ...createInitialBookingForm(), channelId: defaultChannel ? String(defaultChannel.id) : "" });
    setMessage(undefined);
    setError(undefined);
    setFieldErrors({});
    setAvailabilityReloadKey((value) => value + 1);
  }

  function retryAvailability() {
    setAvailabilityReloadKey((value) => value + 1);
  }

  function retryInitialLoad() {
    setInitialLoadError(undefined);
    setLoading(true);
    setFormReloadKey((value) => value + 1);
  }

  function retryCustomerSearch() {
    setCustomerSearchReloadKey((value) => value + 1);
  }

  return {
    form,
    booking,
    options,
    customers,
    duplicateCustomers,
    customerSearch,
    availableRoomIds,
    availabilityError,
    invalidStayTime,
    checkingAvailability,
    loading,
    initialLoadError,
    customerSearchError,
    checkingCustomerSearch,
    saving,
    message,
    error,
    fieldErrors,
    summary,
    setCustomerSearch,
    retryCustomerSearch,
    chooseDuplicateCustomer,
    confirmNewCustomer,
    updateField,
    updateStayDate,
    updateStayNights,
    retryAvailability,
    retryInitialLoad,
    updateStayOption,
    updateEntryMode,
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
