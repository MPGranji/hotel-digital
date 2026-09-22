import { PageHeader } from "@/components/ui/page";
import { OperationsDashboard } from "@/features/dashboard/operations-dashboard";

export default function OperationsPage() {
  return (
    <>
      <PageHeader
        title="Vận hành phòng"
        description="Xem phòng nào đang có khách, đã đặt hoặc còn trống. Tìm theo tên khách, số phòng hay mã đặt phòng khi cần."
      />
      <OperationsDashboard />
    </>
  );
}
