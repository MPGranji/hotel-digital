import { BookingForm } from "@/features/bookings/booking-form";

export default async function BookingsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ bookingId?: string; roomId?: string }> }>) {
  const params = await searchParams;
  const rawId = Number(params.bookingId);
  const roomId = Number(params.roomId);
  return (
    <BookingForm
      bookingId={Number.isInteger(rawId) && rawId > 0 ? rawId : undefined}
      initialRoomId={Number.isInteger(roomId) && roomId > 0 ? roomId : undefined}
    />
  );
}
