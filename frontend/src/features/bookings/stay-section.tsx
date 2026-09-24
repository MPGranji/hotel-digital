import { Check } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/page";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { useBookingForm } from "./use-booking-form";

type FormModel = ReturnType<typeof useBookingForm>;

export function StaySection({ model, disabled }: Readonly<{ model: FormModel; disabled: boolean }>) {
  const {
    form, booking, options, availableRoomIds, availabilityError, invalidStayTime, checkingAvailability, fieldErrors,
    updateField, updateRoomMode, toggleRoom, updateStayDate, updateStayNights, updateStayOption, updateEntryMode, retryAvailability,
  } = model;
  const selectedRoomIds = [form.roomId, ...form.additionalRoomIds].filter(Boolean);
  const selectedRooms = options.rooms.filter((room) => selectedRoomIds.includes(String(room.id)));
  const guestCapacity = selectedRooms.length > 0
    ? selectedRooms.reduce((total, room) => total + room.capacity, 0)
    : undefined;
  const availableRooms = options.rooms.filter((room) => availableRoomIds?.includes(room.id));
  const selectedChannel = options.channels.find((channel) => String(channel.id) === form.channelId);
  const showExternalBookingCode = selectedChannel
    && selectedChannel.category !== "OFFLINE";
  const availableChannels = options.channels.filter((channel) =>
    form.entryMode === "ONLINE" ? channel.category === "ONLINE" : channel.category !== "ONLINE");
  const entryModes = [
    { value: "ADVANCE" as const, title: "Đặt trước", description: "Khách gọi hoặc liên hệ trực tiếp, chưa nhận phòng." },
    { value: "WALK_IN" as const, title: "Nhận phòng tại quầy", description: "Khách đến trực tiếp và nhận phòng ngay." },
    { value: "ONLINE" as const, title: "Đặt qua kênh online", description: "Đặt phòng từ Agoda, Booking.com hoặc kênh tương tự." },
  ];

  return (
    <div className="booking-section">
      <SectionTitle>1. Thông tin lưu trú</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="md:col-span-2 xl:col-span-3">
          <p className="mb-2 text-sm font-medium text-[var(--foreground)]">Khách đặt phòng như thế nào?</p>
          <div className="grid gap-3 md:grid-cols-3">
            {entryModes.map((mode) => {
              const selected = form.entryMode === mode.value;
              return <button
                aria-pressed={selected}
                className={`rounded-xl border p-4 text-left transition-colors ${selected ? "border-[var(--primary)] bg-[var(--nav-active)] ring-1 ring-[var(--primary)]" : "border-[var(--border)] bg-white hover:border-[var(--primary)]"}`}
                disabled={disabled || Boolean(booking)}
                key={mode.value}
                onClick={() => updateEntryMode(mode.value)}
                type="button"
              >
                <span className="flex items-center gap-2 font-semibold text-[var(--foreground)]">{selected ? <Check className="text-[var(--primary)]" size={17} /> : null}{mode.title}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{mode.description}</span>
              </button>;
            })}
          </div>
        </div>
        <div className="md:col-span-2 xl:col-span-3"><h3 className="border-b border-[var(--border)] pb-2 text-sm font-semibold text-[var(--primary-strong)]">Thời gian ở</h3></div>
        <Field error={fieldErrors.checkInAt?.[0]} htmlFor="checkInAt" label="Ngày giờ nhận phòng" required>
          <Input disabled={disabled} id="checkInAt" onChange={(event) => updateStayDate("checkInAt", event.target.value)} type="datetime-local" value={form.checkInAt} />
        </Field>
        <Field error={fieldErrors.checkOutAt?.[0] ?? (invalidStayTime ? "Ngày giờ đi phải sau ngày giờ đến." : undefined)} htmlFor="checkOutAt" label="Ngày giờ trả phòng" required>
          <Input disabled={disabled} id="checkOutAt" onChange={(event) => updateStayDate("checkOutAt", event.target.value)} type="datetime-local" value={form.checkOutAt} />
        </Field>
        <Field error={fieldErrors.billedNights?.[0]} htmlFor="billedNights" label="Số đêm tính tiền" required>
          <Input disabled={disabled} id="billedNights" min="1" onChange={(event) => updateStayNights(event.target.value)} type="number" value={form.billedNights} />
        </Field>
        {!booking ? <div className="md:col-span-2 xl:col-span-3">
          <h3 className="mb-3 border-b border-[var(--border)] pb-2 text-sm font-semibold text-[var(--primary-strong)]">Phòng và số khách</h3>
          <p className="mb-1.5 text-sm font-medium text-[var(--foreground)]">Đặt mấy phòng?</p>
          <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-1">
            <button aria-pressed={form.roomMode === "single"} className={`rounded-md px-4 py-2 text-sm font-medium ${form.roomMode === "single" ? "bg-white text-[var(--primary)] shadow-sm" : "text-[var(--muted)]"}`} onClick={() => updateRoomMode("single")} type="button">Một phòng</button>
            <button aria-pressed={form.roomMode === "multiple"} className={`rounded-md px-4 py-2 text-sm font-medium ${form.roomMode === "multiple" ? "bg-white text-[var(--primary)] shadow-sm" : "text-[var(--muted)]"}`} onClick={() => updateRoomMode("multiple")} type="button">Nhiều phòng</button>
          </div>
          {form.roomMode === "multiple" ? <p className="mt-2 text-sm text-[var(--muted)]">Chọn tối đa 10 phòng bất kỳ còn trống. Số khách là tổng cả nhóm; hệ thống chia khách vào từng phòng theo sức chứa. Mỗi phòng có đặt phòng và hóa đơn riêng.</p> : null}
        </div> : booking.groupCode ? <p className="md:col-span-2 xl:col-span-3 rounded-lg bg-[var(--nav-active)] px-4 py-3 text-sm text-[var(--primary-strong)]">Đặt phòng này thuộc nhóm <b>{booking.groupCode}</b>.</p> : null}

        <div className={`md:col-span-2 xl:col-span-3 ${form.roomMode === "single" || booking ? "max-w-2xl" : ""}`}>
          {availabilityError ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dfc0b9] bg-[#f9efec] px-4 py-3 text-sm text-[#8c493e]" role="alert"><span>{availabilityError}</span><button className="font-semibold underline" onClick={retryAvailability} type="button">Thử lại</button></div> : invalidStayTime ? <p className="rounded-lg bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--muted)]">Sửa giờ đi để xem phòng còn trống.</p> : !form.checkInAt || !form.checkOutAt ? <p className="rounded-lg bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--muted)]">Chọn đủ ngày giờ đến và đi để xem phòng trống.</p> : checkingAvailability ? <p className="rounded-lg bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--muted)]" role="status">Đang tìm phòng còn trống…</p> : form.roomMode === "single" || booking ? (
            <Field error={fieldErrors.roomId?.[0]} htmlFor="roomId" label="Phòng còn trống" required>
              <SearchableSelect
                disabled={disabled || availableRoomIds === undefined}
                emptyText="Không còn phòng phù hợp trong khoảng thời gian này."
                id="roomId"
                onChange={(value) => updateStayOption("roomId", value)}
                options={availableRooms.map((room) => ({ value: String(room.id), label: `${room.roomNumber} · ${room.roomTypeName}`, searchText: `${room.roomNumber} ${room.roomTypeName}` }))}
                placeholder="Chọn phòng"
                searchPlaceholder="Nhập số hoặc hạng phòng…"
                value={form.roomId}
              />
            </Field>
          ) : (
            <Field error={fieldErrors.roomId?.[0] ?? fieldErrors.additionalRoomIds?.[0]} htmlFor="roomCards" label={`Chọn các phòng còn trống${selectedRoomIds.length ? ` · Đã chọn ${selectedRoomIds.length}` : ""}`} required>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" id="roomCards">
                {availableRooms.length === 0 ? <p className="px-2 py-5 text-center text-sm text-slate-500">Không còn phòng phù hợp trong khoảng thời gian này.</p> : <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {availableRooms.map((room) => {
                    const selected = selectedRoomIds.includes(String(room.id));
                    return <button aria-pressed={selected} className={`flex min-h-16 items-center gap-3 rounded-lg border p-3 text-left transition-colors ${selected ? "border-[var(--primary)] bg-[var(--nav-active)] ring-1 ring-[var(--primary)]" : "border-[var(--border)] bg-white hover:border-[var(--primary)] hover:bg-[var(--sidebar)]"}`} disabled={disabled || (!selected && selectedRoomIds.length >= 10)} key={room.id} onClick={() => toggleRoom(String(room.id))} type="button">
                      <span className={`flex size-5 shrink-0 items-center justify-center rounded border ${selected ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)] bg-white"}`}>{selected ? <Check size={14} /> : null}</span>
                      <span><b className="block text-slate-900">Phòng {room.roomNumber}</b><span className="text-xs text-slate-500">{room.roomTypeName}</span></span>
                    </button>;
                  })}
                </div>}
              </div>
              {selectedRooms.length ? <p className="mt-3 text-sm font-medium text-[var(--primary-strong)]">Đã chọn: {selectedRooms.map((room) => room.roomNumber).join(", ")} · Sức chứa {guestCapacity} khách</p> : null}
            </Field>
          )}
        </div>

        <Field
          error={fieldErrors.guestCount?.[0]}
          hint={guestCapacity ? `Tối đa ${guestCapacity} người theo sức chứa ${selectedRooms.length > 1 ? "của các phòng đã chọn" : "phòng đã chọn"}. Để trống nếu chưa xác định.` : "Chọn phòng để xem sức chứa. Có thể để trống nếu chưa xác định."}
          htmlFor="guestCount"
          label={form.roomMode === "multiple" && !booking ? "Tổng số khách của tất cả phòng" : "Số khách trong phòng"}
        >
          <Input disabled={disabled} id="guestCount" max={guestCapacity} min="1" onChange={(event) => updateField("guestCount", event.target.value)} placeholder="Nhập số khách" type="number" value={form.guestCount} />
        </Field>

        <div className="md:col-span-2 xl:col-span-3"><h3 className="border-b border-[var(--border)] pb-2 text-sm font-semibold text-[var(--primary-strong)]">Nguồn đặt phòng</h3></div>

        <Field error={fieldErrors.channelId?.[0]} hint={form.entryMode === "ONLINE" ? "Chọn đúng kênh để lưu nguồn và mã đặt phòng bên ngoài." : "Ví dụ: tại quầy, qua điện thoại hoặc đại lý."} htmlFor="channelId" label="Kênh đặt phòng">
          <SearchableSelect disabled={disabled || form.entryMode === "WALK_IN"} id="channelId" onChange={(value) => updateStayOption("channelId", value)} options={availableChannels.map((channel) => ({ value: String(channel.id), label: channel.name, searchText: `${channel.code} ${channel.category}` }))} placeholder="Chọn kênh" searchPlaceholder="Nhập tên hoặc mã kênh…" value={form.channelId} />
        </Field>
        {showExternalBookingCode ? (
          <Field error={fieldErrors.externalBookingCode?.[0]} htmlFor="externalBookingCode" label={`Mã đặt phòng từ ${selectedChannel.name}`}>
            <Input disabled={disabled} id="externalBookingCode" onChange={(event) => updateField("externalBookingCode", event.target.value)} placeholder={`Nhập mã do ${selectedChannel.name} cung cấp`} value={form.externalBookingCode} />
          </Field>
        ) : null}
      </div>
    </div>
  );
}
