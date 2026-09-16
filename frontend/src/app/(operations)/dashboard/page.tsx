import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function DashboardPage() {
  return (
    <ModulePlaceholder
      eyebrow="Mặc định: tháng hiện tại"
      title="Dashboard vận hành"
      description="Một khu vực thống nhất cho dashboard vận hành gần thời gian thực và báo cáo quản trị Power BI."
      items={["Tổng quan", "Theo ngày", "Power BI", "Tự làm mới dữ liệu"]}
    />
  );
}
