import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function ChannelsPage() {
  return (
    <ModulePlaceholder
      eyebrow="Danh mục"
      title="Kênh đặt phòng"
      description="Quản lý các kênh trực tiếp, OTA, đối tác, nội bộ và nguồn chưa xác định."
      items={["Thêm và sửa kênh", "Ngừng hoạt động", "Nhóm nguồn", "Giữ nguyên lịch sử"]}
    />
  );
}
