import { PageHeader } from "@/components/ui/page";
import { RoomCalendar } from "@/features/rooms/room-calendar";

export default function RoomStatusPage() {
  return (
    <>
      <PageHeader
        description="Xem lịch từng phòng theo ngày hoặc theo giờ, kể cả những ngày sắp tới."
        title="Hiện trạng phòng"
      />
      <RoomCalendar />
    </>
  );
}
