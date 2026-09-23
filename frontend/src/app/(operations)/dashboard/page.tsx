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
      <p className="mt-2 text-sm text-[var(--muted)]">Số liệu trong báo cáo này theo lịch làm mới của Power BI.</p>
      <PowerBiReport embedUrl={env.powerBiEmbedUrl} />
    </details> : null}
  </div>;
}
