import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function BookingsPage() {
  return (
    <ModulePlaceholder
      eyebrow="Vận hành"
      title="Đặt phòng & Check-in"
      description="Tạo hoặc cập nhật lượt lưu trú, thông tin khách và thanh toán trên cùng một biểu mẫu."
      items={["Chọn phòng và thời gian", "Tìm hoặc tạo khách", "Doanh thu và thanh toán", "Thao tác trạng thái"]}
    />
  );
}
