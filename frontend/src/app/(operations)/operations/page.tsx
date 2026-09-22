import { PageHeader } from "@/components/ui/page";
import { OperationsDashboard } from "@/features/dashboard/operations-dashboard";

export default function OperationsPage() {
  return (
    <>
      <PageHeader
        title="Khách & phòng"
        description="Màn hình nội bộ theo dõi hiện trạng từng phòng, khách đang lưu trú và booking kế tiếp. Đây không phải trang của báo cáo Power BI."
      />
      <OperationsDashboard />
    </>
  );
}
