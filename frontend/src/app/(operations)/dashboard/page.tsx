import { redirect } from "next/navigation";
import Link from "next/link";
import { BusinessDashboard } from "@/features/dashboard/business-dashboard";
import { LiveRoomOverview } from "@/features/dashboard/live-room-overview";
import { PowerBiReport } from "@/features/dashboard/power-bi-report";
import { env } from "@/lib/env";

export default async function DashboardPage({ searchParams }: Readonly<{ searchParams: Promise<{ view?: string }> }>) {
  const params = await searchParams;
  if (params.view === "operations") redirect("/operations");
  const view = params.view === "live" || params.view === "business" ? params.view : "powerbi";

  return <div className="space-y-6">
    <nav aria-label="Chế độ dashboard" className="flex w-fit flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1">
      <Link aria-current={view === "powerbi" ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${view === "powerbi" ? "bg-[var(--primary)] text-white" : "text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]"}`} href="/dashboard">Power BI</Link>
      <Link aria-current={view === "live" ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${view === "live" ? "bg-[var(--primary)] text-white" : "text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]"}`} href="/dashboard?view=live">Theo dõi trực tiếp</Link>
      <Link aria-current={view === "business" ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${view === "business" ? "bg-[var(--primary)] text-white" : "text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]"}`} href="/dashboard?view=business">Báo cáo web</Link>
    </nav>
    {view === "powerbi" ? <section aria-labelledby="power-bi-title" className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]" id="power-bi-title">Dashboard Power BI</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Báo cáo công khai, không cần đăng nhập Microsoft. Số liệu làm mới theo lịch của Power BI.</p>
      </div>
      <PowerBiReport embedUrl={env.powerBiEmbedUrl} />
      <a className="inline-block text-sm font-semibold text-[var(--primary)] hover:underline" href={env.powerBiEmbedUrl} rel="noopener noreferrer" target="_blank">Mở Power BI toàn màn hình →</a>
    </section> : view === "business" ? <BusinessDashboard /> : <>
      <h1 className="sr-only">Dashboard trực tiếp</h1>
      <LiveRoomOverview />
    </>}
  </div>;
}
