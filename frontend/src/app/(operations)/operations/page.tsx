import { PageHeader } from "@/components/ui/page";
import { OperationsDashboard } from "@/features/dashboard/operations-dashboard";

export default function OperationsPage() {
  return (
    <>
      <PageHeader
        title="Ca trực hôm nay"
        description="Xử lý lượt khách đến, khách đang ở và khách chuẩn bị trả phòng. Lịch từng phòng nằm ở mục Hiện trạng phòng."
      />
      <OperationsDashboard />
    </>
  );
}
