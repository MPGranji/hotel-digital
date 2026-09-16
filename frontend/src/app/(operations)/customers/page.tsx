import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function CustomersPage() {
  return (
    <ModulePlaceholder
      eyebrow="Khách lưu trú"
      title="Khách hàng"
      description="Tra cứu hồ sơ và lịch sử lưu trú, mặc định sắp xếp theo ngày check-in gần nhất."
      items={["Tìm tên, SĐT hoặc giấy tờ", "Ngày check-in gần nhất", "Lịch sử lưu trú", "Cập nhật hồ sơ"]}
    />
  );
}
