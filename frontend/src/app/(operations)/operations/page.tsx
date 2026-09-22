import { PageHeader } from "@/components/ui/page";
import { OperationsDashboard } from "@/features/dashboard/operations-dashboard";

export default function OperationsPage() {
  return (
    <>
      <PageHeader
        title="Vận hành phòng"
        description="Theo dõi theo thời gian thực tình trạng phòng, khách đang lưu trú và lượt đặt phòng sắp tới."
      />
      <OperationsDashboard />
    </>
  );
}
