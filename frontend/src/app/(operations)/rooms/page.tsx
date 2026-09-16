import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function RoomsPage() {
  return (
    <ModulePlaceholder
      eyebrow="Danh mục"
      title="Phòng"
      description="Theo dõi phòng trống, phòng đã đặt, phòng đang có khách và lần nhận phòng kế tiếp."
      items={["Tình trạng hiện tại", "Khách hiện tại", "Check-in nhanh", "Lần nhận phòng kế tiếp"]}
    />
  );
}
