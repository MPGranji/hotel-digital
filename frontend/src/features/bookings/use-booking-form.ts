"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiErrorMessage, getApiProblem, READ_TIMEOUT_MS } from "@/lib/api-client";
import { toDateTimeLocal } from "@/lib/format";
import { useLiveRevision } from "@/features/realtime/live-updates-provider";
import { findCustomerDuplicates, getCustomers } from "@/features/customers/customers-api";
import type { CustomerDuplicateItem, CustomerListItem } from "@/features/customers/types";
import {
  adjustBookingAndRefund,
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
import { joinNote, splitNote, type ChargeKind, type ChargeLine } from "./charge-notes";

/** Which existing charge a save replaces: a listed line, or the undescribed part of a total. */
export type ChargeEditTarget = { index: number } | { unlisted: ChargeKind; amount: number };
import type { BookingDetail, BookingOptions, BookingRefundInput } from "./types";

function getDefaultChannel(channels: BookingOptions["channels"]) {
  return channels.find((channel) => channel.code === "DIRECT")
    ?? channels.find((channel) => channel.category === "OFFLINE")
    ?? channels[0];
}

function getOnlineChannel(channels: BookingOptions["channels"]) {
  return channels.find((channel) => channel.category === "ONLINE");
}

export function useBookingForm(bookingId?: number, initialRoomId?: number, initialCheckInDate?: string, initialCheckOutDate?: string) {
  const liveRevision = useLiveRevision();
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
  const [remoteChangeAvailable, setRemoteChangeAvailable] = useState(false);
  const latestState = useRef({ form, booking, saving });
  const hasUnsavedChanges = Boolean(booking) && JSON.stringify(form) !== JSON.stringify(formFromBooking(booking!));

  useEffect(() => { latestState.current = { form, booking, saving }; }, [form, booking, saving]);
  const customerSearchKey = `${customerSearch}|${customerSearchReloadKey}`;
  const currentCustomerSearch = customerSearchResult?.key === customerSearchKey ? customerSearchResult : undefined;
  const customers = currentCustomerSearch?.items ?? [];
  const customerSearchError = currentCustomerSearch?.error;
  const checkingCustomerSearch = form.customerMode === "existing" && !currentCustomerSearch;
  const availabilityKey = `${form.checkInAt}|${form.checkOutAt}|${bookingId ?? "new"}|${availabilityReloadKey}|${liveRevision}`;
  const checkInTime = new Date(form.checkInAt).getTime();
  const checkOutTime = new Date(form.checkOutAt).getTime();
  const invalidStayTime = Boolean(form.checkInAt && form.checkOutAt)
    && (!Number.isFinite(checkInTime) || !Number.isFinite(checkOutTime) || checkOutTime <= checkInTime);
  const canCheckAvailability = Boolean(form.checkInAt && form.checkOutAt) && !invalidStayTime;
  const currentAvailability = availability?.key === availabilityKey ? availability : undefined;
  const availableRoomIds = currentAvailability?.ids;
  const availabilityError = currentAvailability?.error;
  const checkingAvailability = canCheckAvailability && !currentAvailability;
  // A saved booking only needs a fresh availability check when its room or stay times change,
  // so adding a charge for an in-house guest is not blocked by a slow or failing availability lookup.
  const savedStay = booking ? formFromBooking(booking) : undefined;
  const stayChanged = !savedStay || form.roomId !== savedStay.roomId || form.checkInAt !== savedStay.checkInAt || form.checkOutAt !== savedStay.checkOutAt;
  const availabilityReady = !checkingAvailability && Boolean(availableRoomIds) && !availabilityError;
  const canSave = !saving && !invalidStayTime && (!stayChanged || availabilityReady);

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
          setRemoteChangeAvailable(false);
        }
      })
      .catch((reason) => { if (active) setInitialLoadError(getApiErrorMessage(reason, "Không thể tải biểu mẫu đặt phòng.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingId, formReloadKey, initialCheckInDate, initialCheckOutDate, initialRoomId]);

  useEffect(() => {
    if (!bookingId || liveRevision === 0 || !latestState.current.booking) return;
    let active = true;
    const isDirty = () => {
      const current = latestState.current;
      return current.saving || (current.booking && JSON.stringify(current.form) !== JSON.stringify(formFromBooking(current.booking)));
    };
    void getBooking(bookingId).then((loaded) => {
      if (!active || latestState.current.booking?.version === loaded.version) return;
      if (isDirty()) { setRemoteChangeAvailable(true); return; }
      setBooking(loaded);
      setForm(formFromBooking(loaded));
      setCustomerSearch(loaded.customerName);
      setRemoteChangeAvailable(false);
    }).catch(() => { /* The current form remains usable; the next signal retries. */ });
    return () => { active = false; };
  }, [bookingId, liveRevision]);

  useEffect(() => {
    if (liveRevision === 0) return;
    let active = true;
    void getBookingOptions()
      .then((loaded) => { if (active) setOptions(loaded); })
      .catch(() => { /* The current options remain available until the next reconciliation. */ });
    return () => { active = false; };
  }, [liveRevision]);

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
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(READ_TIMEOUT_MS)]);
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
    const total = gross + (Number(form.previousDebt) || 0);
    const recordedPaid = booking?.paidAmount ?? paid;
    const debt = Number(form.debtAmount) || 0;
    return {
      gross,
      paid,
      total,
      recordedPaid,
      debt,
      balance: total - recordedPaid - debt,
      savedTotal: booking ? booking.previousDebt + booking.grossRevenue : undefined,
      averageRate: gross >= 0 ? room / Math.max(Number(form.billedNights) || 1, 1) : 0,
    };
  }, [booking, form]);

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
      return bookingId ? next : withSuggestedRoomRevenue(next);
    });
    clearFieldErrors("checkInAt", "checkOutAt", "billedNights");
  }

  function moveStayToNow(now: string) {
    setMessage(undefined);
    setError(undefined);
    setForm((current) => bookingId ? {
      ...current,
      checkInAt: now,
      checkOutAt: calculateCheckOutAt(now, current.checkOutAt, current.billedNights),
    } : withSuggestedRoomRevenue({
      ...current,
      checkInAt: now,
      checkOutAt: calculateCheckOutAt(now, current.checkOutAt, current.billedNights),
    }));
    clearFieldErrors("checkInAt", "checkOutAt", "billedNights");
  }

  function updateStayNights(value: string) {
    setMessage(undefined);
    setError(undefined);
    setForm((current) => bookingId ? {
      ...current,
      billedNights: value,
      checkOutAt: calculateCheckOutAt(current.checkInAt, current.checkOutAt, value),
    } : withSuggestedRoomRevenue({
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
      const next = {
        ...current,
        [field]: value,
        entryMode: field === "channelId" && current.entryMode !== "WALK_IN"
          ? selectedChannel?.category === "ONLINE" ? "ONLINE" : "ADVANCE"
          : current.entryMode,
        roomRevenue: field === "channelId" && !directChannel && !bookingId ? "" : current.roomRevenue,
        externalBookingCode: directChannel ? "" : current.externalBookingCode,
        additionalRoomIds: field === "roomId" ? current.additionalRoomIds.filter((id) => id !== value) : current.additionalRoomIds,
      };
      return bookingId ? next : withSuggestedRoomRevenue(next);
    });
    clearFieldErrors(field, "roomRevenue", "externalBookingCode");
  }

  function updateEntryMode(entryMode: BookingEntryMode) {
    const channel = entryMode === "ONLINE"
      ? getOnlineChannel(options.channels)
      : getDefaultChannel(options.channels);
    const walkInCheckIn = toDateTimeLocal(new Date());
    const walkInCheckOut = calculateCheckOutAt(walkInCheckIn, "", "1");
    setMessage(undefined);
    setError(undefined);
    setForm((current) => withSuggestedRoomRevenue({
      ...current,
      entryMode,
      channelId: channel ? String(channel.id) : "",
      externalBookingCode: entryMode === "ONLINE" ? current.externalBookingCode : "",
      checkInAt: entryMode === "WALK_IN" ? walkInCheckIn : current.checkInAt,
      checkOutAt: entryMode === "WALK_IN" ? walkInCheckOut : current.checkOutAt,
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

  function applySuggestedRoomRevenue() {
    setForm((current) => withSuggestedRoomRevenue(current));
    setMessage(undefined);
    setError(undefined);
    clearFieldErrors("roomRevenue");
  }

  /**
   * Adds a charge, or replaces the one named by `target` (a listed line, or the part of a total that has no line),
   * keeping the service/surcharge totals in step. Returns an error message, or undefined on success.
   */
  function recordAdditionalCharge(kind: ChargeKind, quantity: string, unitPrice: string, description: string, target?: ChargeEditTarget) {
    const count = Number(quantity);
    const price = Number(unitPrice);
    const text = description.trim();
    if (!text) return "Chọn hoặc nhập nội dung khoản phát sinh.";
    if (!Number.isSafeInteger(count) || count < 1 || count > 999) return "Số lượng phải từ 1 đến 999.";
    if (!Number.isSafeInteger(price) || price <= 0) return "Nhập đơn giá lớn hơn 0.";
    if (!Number.isSafeInteger(count * price)) return "Thành tiền vượt giới hạn cho phép.";
    const { text: noteText, charges } = splitNote(form.note);
    const previous = target && "index" in target ? charges[target.index] : target ? { kind: target.unlisted, amount: target.amount } : undefined;
    const next: ChargeLine = { kind, description: text, quantity: count, amount: count * price };
    const nextCharges = target && "index" in target ? charges.map((charge, index) => (index === target.index ? next : charge)) : [...charges, next];
    const nextNote = joinNote(noteText, nextCharges);
    if (nextNote.length > 1000) return "Đã đạt giới hạn 1.000 ký tự cho ghi chú và các khoản phát sinh. Hãy rút gọn nội dung.";
    setForm((current) => {
      const totals = { serviceRevenue: Number(current.serviceRevenue) || 0, surchargeAmount: Number(current.surchargeAmount) || 0 };
      if (previous) totals[previous.kind] = Math.max(0, totals[previous.kind] - previous.amount);
      totals[kind] += next.amount;
      return { ...current, serviceRevenue: String(totals.serviceRevenue), surchargeAmount: String(totals.surchargeAmount), note: nextNote };
    });
    setMessage(undefined);
    setError(undefined);
    clearFieldErrors("serviceRevenue", "surchargeAmount", "note");
    return undefined;
  }

  function removeAdditionalCharge(index: number) {
    setForm((current) => {
      const { text, charges } = splitNote(current.note);
      const removed = charges[index];
      if (!removed) return current;
      return {
        ...current,
        [removed.kind]: String(Math.max(0, (Number(current[removed.kind]) || 0) - removed.amount)),
        note: joinNote(text, charges.filter((_, position) => position !== index)),
      };
    });
    setMessage(undefined);
    setError(undefined);
  }

  /** Drops the part of a total that has no itemised line, leaving only the listed charges. */
  function removeUnlistedCharge(kind: ChargeKind) {
    setForm((current) => {
      const listed = splitNote(current.note).charges.filter((charge) => charge.kind === kind).reduce((sum, charge) => sum + charge.amount, 0);
      return { ...current, [kind]: String(Math.min(Number(current[kind]) || 0, listed)) };
    });
    setMessage(undefined);
    setError(undefined);
  }

  /** Early departure: ends the stay now and re-prices the room when a counter rate applies. */
  function endStayNow(now: string) {
    setMessage(undefined);
    setError(undefined);
    setForm((current) => withSuggestedRoomRevenue({ ...current, checkOutAt: now, billedNights: calculateNights(current.checkInAt, now) }));
    clearFieldErrors("checkOutAt", "billedNights", "roomRevenue");
  }

  function updateNoteText(text: string) {
    updateField("note", joinNote(text, splitNote(form.note).charges));
  }

  function fillRemainingDebt() {
    setForm((current) => {
      const gross = (Number(current.roomRevenue) || 0) + (Number(current.serviceRevenue) || 0)
        + (Number(current.surchargeAmount) || 0) - (Number(current.discountAmount) || 0);
      const total = gross + (Number(current.previousDebt) || 0);
      return { ...current, debtAmount: String(Math.max(0, total - (booking?.paidAmount ?? 0))) };
    });
    setMessage(undefined);
    setError(undefined);
    clearFieldErrors("debtAmount");
  }

  async function refreshBooking() {
    if (!bookingId) return undefined;
    const loaded = await getBooking(bookingId);
    setBooking(loaded);
    setForm(formFromBooking(loaded));
    setCustomerSearch(loaded.customerName);
    setRemoteChangeAvailable(false);
    return loaded;
  }

  async function acceptRemoteChanges() {
    try {
      await refreshBooking();
      setError(undefined);
      setFieldErrors({});
      setMessage("Đã tải phiên bản đặt phòng mới nhất.");
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Không thể tải phiên bản đặt phòng mới nhất."));
    }
  }

  async function submit(refunds?: BookingRefundInput[]) {
    if (remoteChangeAvailable) {
      setError("Đặt phòng đã thay đổi ở nơi khác. Tải phiên bản mới trước khi lưu.");
      return;
    }
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
        ? refunds ? await adjustBookingAndRefund(bookingId, request, refunds) : await updateBooking(bookingId, request)
        : await createBooking(request);
      setBooking(saved);
      setForm(formFromBooking(saved));
      setRemoteChangeAvailable(false);
      setMessage(bookingId
        ? refunds ? `Đã lưu thay đổi và ghi nhận hoàn ${refunds.reduce((sum, refund) => sum + refund.amount, 0).toLocaleString("vi-VN")} đ.` : "Đã lưu thay đổi đặt phòng."
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
    if (remoteChangeAvailable) {
      setError("Đặt phòng đã thay đổi ở nơi khác. Tải phiên bản mới trước khi đổi trạng thái.");
      return false;
    }
    setSaving(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const updated = await changeBookingStatus(booking.id, action, booking.version);
      setBooking(updated);
      setForm(formFromBooking(updated));
      setRemoteChangeAvailable(false);
      setMessage("Đã cập nhật trạng thái đặt phòng.");
      return true;
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Không thể cập nhật trạng thái đặt phòng."));
      return false;
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
    setRemoteChangeAvailable(false);
    setAvailabilityReloadKey((value) => value + 1);
  }

  function discardChanges() {
    if (!booking) return;
    setForm(formFromBooking(booking));
    setCustomerSearch(booking.customerName);
    setMessage(undefined);
    setError(undefined);
    setFieldErrors({});
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
    remoteChangeAvailable,
    hasUnsavedChanges,
    fieldErrors,
    summary,
    setCustomerSearch,
    retryCustomerSearch,
    chooseDuplicateCustomer,
    confirmNewCustomer,
    updateField,
    updateStayDate,
    moveStayToNow,
    updateStayNights,
    retryAvailability,
    retryInitialLoad,
    updateStayOption,
    updateEntryMode,
    updateRoomMode,
    toggleRoom,
    applySuggestedRoomRevenue,
    suggestedRoomRevenue: calculateSuggestedRoomRevenue(form, options),
    recordAdditionalCharge,
    removeAdditionalCharge,
    removeUnlistedCharge,
    endStayNow,
    canSave,
    updateNoteText,
    fillRemainingDebt,
    refreshBooking,
    acceptRemoteChanges,
    submit,
    changeStatus,
    discardChanges,
    reset,
  };
}

function hasDuplicateSignal(phone: string, email: string, identityDocument: string) {
  const phoneDigits = phone.replace(/\D/g, "");
  return phoneDigits.length >= 8
    || email.trim().includes("@")
    || identityDocument.replace(/[^\p{L}\p{N}]/gu, "").length >= 6;
}
