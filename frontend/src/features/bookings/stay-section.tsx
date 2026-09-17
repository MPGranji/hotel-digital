import { Check } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/page";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { useBookingForm } from "./use-booking-form";

type FormModel = ReturnType<typeof useBookingForm>;

export function StaySection({ model, disabled }: Readonly<{ model: FormModel; disabled: boolean }>) {
  const {
    form, booking, options, availableRoomIds, checkingAvailability, fieldErrors,
    updateField, updateRoomMode, toggleRoom, updateStayDate, updateStayNights, updateStayOption,
  } = model;
  const selectedRoomIds = [form.roomId, ...form.additionalRoomIds].filter(Boolean);
  const availableRooms = options.rooms.filter((room) =>
    availableRoomIds?.includes(room.id) || (booking && String(room.id) === form.roomId));
  const selectedChannel = options.channels.find((channel) => String(channel.id) === form.channelId);
  const showExternalBookingCode = selectedChannel
    && selectedChannel.category !== "DIRECT"
    && selectedChannel.category !== "INTERNAL";

  return (
    <div>
      <SectionTitle>1. Thời gian, phòng và kênh đặt</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field error={fieldErrors.checkInAt?.[0]} htmlFor="checkInAt" label="Ngày giờ đến" required>
          <Input disabled={disabled} id="checkInAt" onChange={(event) => updateStayDate("checkInAt", event.target.value)} type="datetime-local" value={form.checkInAt} />
        </Field>
        <Field error={fieldErrors.checkOutAt?.[0]} htmlFor="checkOutAt" label="Ngày giờ đi" required>
          <Input disabled={disabled} id="checkOutAt" onChange={(event) => updateStayDate("checkOutAt", event.target.value)} type="datetime-local" value={form.checkOutAt} />
        </Field>
        <Field error={fieldErrors.billedNights?.[0]} htmlFor="billedNights" label="Số đêm tính tiền" required>
          <Input disabled={disabled} id="billedNights" min="1" onChange={(event) => updateStayNights(event.target.value)} type="number" value={form.billedNights} />
        </Field>

        {!booking ? <div className="md:col-span-2 xl:col-span-3">
          <p className="mb-1.5 text-sm font-medium text-slate-700">Số phòng cần đặt</p>
          <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1">
            <button className={`rounded-md px-4 py-2 text-sm font-semibold ${form.roomMode === "single" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`} onClick={() => updateRoomMode("single")} type="button">Một phòng</button>
            <button className={`rounded-md px-4 py-2 text-sm font-semibold ${form.roomMode === "multiple" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`} onClick={() => updateRoomMode("multiple")} type="button">Nhiều phòng</button>
          </div>
        </div> : booking.groupCode ? <p className="md:col-span-2 xl:col-span-3 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">Booking thuộc nhóm <b>{booking.groupCode}</b>.</p> : null}

        <div className={`md:col-span-2 xl:col-span-3 ${form.roomMode === "single" || booking ? "max-w-2xl" : ""}`}>
          {checkingAvailability ? <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-700">Đang kiểm tra phòng trống theo thời gian đã chọn…</div> : form.roomMode === "single" || booking ? (
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
                    return <button aria-pressed={selected} className={`flex min-h-16 items-center gap-3 rounded-lg border p-3 text-left transition ${selected ? "border-blue-500 bg-blue-50 ring-1 ring-blue-300" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"}`} disabled={disabled} key={room.id} onClick={() => toggleRoom(String(room.id))} type="button">
                      <span className={`flex size-5 shrink-0 items-center justify-center rounded border ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"}`}>{selected ? <Check size={14} /> : null}</span>
                      <span><b className="block text-slate-900">Phòng {room.roomNumber}</b><span className="text-xs text-slate-500">{room.roomTypeName}</span></span>
                    </button>;
                  })}
                </div>}
              </div>
            </Field>
          )}
        </div>

        <Field error={fieldErrors.channelId?.[0]} hint="Mặc định là khách đặt trực tiếp tại quầy; chỉ đổi khi booking đến từ kênh khác." htmlFor="channelId" label="Kênh đặt phòng">
          <SearchableSelect disabled={disabled} id="channelId" onChange={(value) => updateStayOption("channelId", value)} options={options.channels.map((channel) => ({ value: String(channel.id), label: channel.name, searchText: `${channel.code} ${channel.category}` }))} placeholder="Chọn kênh" searchPlaceholder="Nhập tên hoặc mã kênh…" value={form.channelId} />
        </Field>
        {showExternalBookingCode ? (
          <Field error={fieldErrors.externalBookingCode?.[0]} htmlFor="externalBookingCode" label={`Mã booking từ ${selectedChannel.name}`}>
            <Input disabled={disabled} id="externalBookingCode" onChange={(event) => updateField("externalBookingCode", event.target.value)} placeholder={`Nhập mã do ${selectedChannel.name} cung cấp`} value={form.externalBookingCode} />
          </Field>
        ) : null}
      </div>
    </div>
  );
}
