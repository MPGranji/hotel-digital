import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function LedgerPage() {
  return (
    <ModulePlaceholder
      eyebrow="Sổ vận hành"
      title="Sổ đặt phòng"
      description="Tra cứu, lọc và phân trang booking; nhập dữ liệu lịch sử hoặc xuất kết quả sang Excel."
      items={["Bộ lọc server-side", "Nhập Excel có xem trước", "Xuất Excel theo bộ lọc", "Xem và sửa booking"]}
    />
  );
}
