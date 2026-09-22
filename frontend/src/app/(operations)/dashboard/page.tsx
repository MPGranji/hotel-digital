import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { DataMessage, PageHeader, Panel } from "@/components/ui/page";
import { OperationsDashboard } from "@/features/dashboard/operations-dashboard";
import { env } from "@/lib/env";

export default async function DashboardPage({ searchParams }: Readonly<{ searchParams: Promise<{ view?: string }> }>) {
  const params = await searchParams;
  const operationsView = params.view === "operations";
  const embedUrl = env.powerBiEmbedUrl;

  return (
    <>
      <PageHeader
        title={operationsView ? "Theo dõi khách & phòng" : "Tổng quan"}
        description={operationsView ? "Hiện trạng từng phòng, khách đang lưu trú và booking kế tiếp trên màn hình nội bộ." : "Báo cáo Power BI tổng quan. Khung báo cáo tự mở rộng theo chiều cao màn hình để dễ đọc hơn."}
        actions={!operationsView && embedUrl ? (
          <a
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            href={embedUrl}
            rel="noreferrer"
            target="_blank"
          >
            Mở trong Power BI
            <ExternalLink aria-hidden="true" size={16} />
          </a>
        ) : undefined}
      />

      <nav aria-label="Hai trang dashboard" className="mb-5 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <DashboardTab active={!operationsView} href="/dashboard" label="1. Tổng quan" />
        <DashboardTab active={operationsView} href="/dashboard?view=operations" label="2. Khách & phòng" />
      </nav>

      {operationsView ? <OperationsDashboard /> : <Panel className="overflow-hidden p-0">
        {embedUrl ? (
          <iframe
            allow="fullscreen"
            allowFullScreen
            className="block h-[calc(100dvh-190px)] min-h-[820px] w-full border-0"
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
            src={embedUrl}
            title="Dashboard quản trị khách sạn trên Power BI"
          />
        ) : (
          <div className="p-5">
            <DataMessage
              title="Dashboard Power BI chưa được kết nối"
              description="Cấu hình NEXT_PUBLIC_POWER_BI_PUBLIC_URL bằng đường dẫn Publish to web của báo cáo."
            />
          </div>
        )}
      </Panel>}
    </>
  );
}

function DashboardTab({ active, href, label }: Readonly<{ active: boolean; href: string; label: string }>) {
  return <Link className={`min-h-10 whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${active ? "border-blue-200 bg-blue-50 text-blue-800" : "border-transparent text-slate-600 hover:bg-slate-50"}`} href={href}>{label}</Link>;
}
