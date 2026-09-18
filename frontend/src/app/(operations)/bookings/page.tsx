import { BookingForm } from "@/features/bookings/booking-form";

export default async function BookingsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ bookingId?: string; roomId?: string; checkInDate?: string; checkOutDate?: string; mode?: string }> }>) {
  const params = await searchParams;
  const rawId = Number(params.bookingId);
  const bookingId = Number.isInteger(rawId) && rawId > 0 ? rawId : undefined;
  const roomId = Number(params.roomId);
  return (
    <BookingForm
      bookingId={bookingId}
      initialCheckInDate={params.checkInDate}
      initialCheckOutDate={params.checkOutDate}
      initialRoomId={Number.isInteger(roomId) && roomId > 0 ? roomId : undefined}
      readOnly={Boolean(bookingId) && params.mode === "view"}
    />
  );
}
