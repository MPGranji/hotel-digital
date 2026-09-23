import { RoomCalendar } from "@/features/rooms/room-calendar";

export default function RoomStatusPage() {
  return (
    <div className="flex min-h-0 flex-col xl:h-full">
      <div className="mb-4 shrink-0 border-b border-[var(--border)] pb-3">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-[var(--foreground)]">Hiện trạng phòng</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Xem lịch từng phòng theo ngày hoặc theo giờ, kể cả những ngày sắp tới.</p>
      </div>
      <RoomCalendar />
    </div>
  );
}
