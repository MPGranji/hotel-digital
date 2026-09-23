import { redirect } from "next/navigation";
import { BusinessDashboard } from "@/features/dashboard/business-dashboard";
import { PowerBiReport } from "@/features/dashboard/power-bi-report";
import { env } from "@/lib/env";

export default async function DashboardPage({ searchParams }: Readonly<{ searchParams: Promise<{ view?: string }> }>) {
  const params = await searchParams;
  if (params.view === "operations") redirect("/operations");
  return <div className="space-y-8">
    <BusinessDashboard />
    {env.powerBiEmbedUrl ? <details open className="rounded-xl border border-[var(--border)] bg-white p-5">
      <summary className="cursor-pointer text-base font-semibold">Báo cáo Power BI</summary>
      <p className="mt-2 text-sm text-[var(--muted)]">Báo cáo Power BI cập nhật theo lịch làm mới dữ liệu; số liệu thời gian thực nằm ở dashboard phía trên.</p>
      <PowerBiReport embedUrl={env.powerBiEmbedUrl} />
    </details> : null}
  </div>;
}
