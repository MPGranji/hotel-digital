import { BookingForm } from "@/features/bookings/booking-form";

export default async function BookingsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ bookingId?: string }> }>) {
  const rawId = Number((await searchParams).bookingId);
  return <BookingForm bookingId={Number.isInteger(rawId) && rawId > 0 ? rawId : undefined} />;
}
