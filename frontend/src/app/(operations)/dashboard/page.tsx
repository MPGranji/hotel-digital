import { redirect } from "next/navigation";
import Link from "next/link";
import { BusinessDashboard } from "@/features/dashboard/business-dashboard";
import { LiveRoomOverview } from "@/features/dashboard/live-room-overview";

export default async function DashboardPage({ searchParams }: Readonly<{ searchParams: Promise<{ view?: string }> }>) {
  const params = await searchParams;
  if (params.view === "operations") redirect("/operations");
  const businessView = params.view === "business";

  return <div className="space-y-6">
    <nav aria-label="Chế độ dashboard" className="flex w-fit flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-1">
      <Link aria-current={!businessView ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${!businessView ? "bg-[var(--primary)] text-white" : "text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]"}`} href="/dashboard">Theo dõi trực tiếp</Link>
      <Link aria-current={businessView ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${businessView ? "bg-[var(--primary)] text-white" : "text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]"}`} href="/dashboard?view=business">Báo cáo kinh doanh</Link>
    </nav>
    {businessView ? <BusinessDashboard /> : <>
      <h1 className="sr-only">Dashboard trực tiếp</h1>
      <LiveRoomOverview />
    </>}
  </div>;
}
