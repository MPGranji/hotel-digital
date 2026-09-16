import { Field, Input, Select } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/page";
import type { useBookingForm } from "./use-booking-form";

type FormModel = ReturnType<typeof useBookingForm>;

export function StaySection({ model, disabled }: Readonly<{ model: FormModel; disabled: boolean }>) {
  const { form, options, availableRoomIds, fieldErrors, updateField, updateStayDate } = model;

  return (
    <div>
      <SectionTitle>1. Phòng, kênh và thời gian lưu trú</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field error={fieldErrors.roomId?.[0]} htmlFor="roomId" label="Phòng lưu trú" required>
          <Select disabled={disabled} id="roomId" onChange={(event) => updateField("roomId", event.target.value)} value={form.roomId}>
            <option value="">Chọn phòng</option>
            {options.rooms.map((room) => {
              const unavailable = availableRoomIds.length > 0 && !availableRoomIds.includes(room.id) && String(room.id) !== form.roomId;
              return (
                <option disabled={unavailable} key={room.id} value={room.id}>
                  {room.roomNumber} · {room.roomTypeName}{unavailable ? " · Đã có khách" : ""}
                </option>
              );
            })}
          </Select>
        </Field>
        <Field error={fieldErrors.channelId?.[0]} htmlFor="channelId" label="Kênh đặt phòng" required>
          <Select disabled={disabled} id="channelId" onChange={(event) => updateField("channelId", event.target.value)} value={form.channelId}>
            <option value="">Chọn kênh</option>
            {options.channels.map((channel) => (
              <option key={channel.id} value={channel.id}>{channel.name}</option>
            ))}
          </Select>
        </Field>
        <Field error={fieldErrors.billedNights?.[0]} htmlFor="billedNights" label="Số đêm tính tiền" required>
          <Input disabled={disabled} id="billedNights" min="1" onChange={(event) => updateField("billedNights", event.target.value)} type="number" value={form.billedNights} />
        </Field>
        <Field error={fieldErrors.checkInAt?.[0]} htmlFor="checkInAt" label="Ngày giờ đến" required>
          <Input disabled={disabled} id="checkInAt" onChange={(event) => updateStayDate("checkInAt", event.target.value)} type="datetime-local" value={form.checkInAt} />
        </Field>
        <Field error={fieldErrors.checkOutAt?.[0]} htmlFor="checkOutAt" label="Ngày giờ đi" required>
          <Input disabled={disabled} id="checkOutAt" onChange={(event) => updateStayDate("checkOutAt", event.target.value)} type="datetime-local" value={form.checkOutAt} />
        </Field>
        <Field error={fieldErrors.externalBookingCode?.[0]} htmlFor="externalBookingCode" label="Mã booking bên ngoài">
          <Input disabled={disabled} id="externalBookingCode" onChange={(event) => updateField("externalBookingCode", event.target.value)} placeholder="Ví dụ: Agoda, Booking.com…" value={form.externalBookingCode} />
        </Field>
      </div>
    </div>
  );
}
