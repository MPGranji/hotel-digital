import { redirect } from "next/navigation";
import { PowerBiReport } from "@/features/dashboard/power-bi-report";
import { env } from "@/lib/env";

export default async function DashboardPage({ searchParams }: Readonly<{ searchParams: Promise<{ view?: string }> }>) {
  const params = await searchParams;
  if (params.view === "operations") redirect("/operations");
  return <section aria-labelledby="power-bi-title" className="space-y-4">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]" id="power-bi-title">Báo cáo quản trị</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Dashboard Power BI công khai, không cần đăng nhập Microsoft. Số liệu làm mới theo lịch của Power BI.</p>
    </div>
    <PowerBiReport embedUrl={env.powerBiEmbedUrl} />
    <a className="inline-block text-sm font-semibold text-[var(--primary)] hover:underline" href={env.powerBiEmbedUrl} rel="noopener noreferrer" target="_blank">Mở Power BI toàn màn hình →</a>
  </section>;
}
