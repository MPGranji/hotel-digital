import { redirect } from "next/navigation";
import { PowerBiReport } from "@/features/dashboard/power-bi-report";
import { env } from "@/lib/env";

export default async function DashboardPage({ searchParams }: Readonly<{ searchParams: Promise<{ view?: string }> }>) {
  const params = await searchParams;
  if (params.view === "operations") redirect("/operations");
  return <section aria-labelledby="power-bi-title" className="lg:h-full">
    <h1 className="sr-only" id="power-bi-title">Báo cáo quản trị</h1>
    <PowerBiReport embedUrl={env.powerBiEmbedUrl} />
  </section>;
}
