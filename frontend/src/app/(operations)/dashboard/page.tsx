import { ExternalLink } from "lucide-react";
import { redirect } from "next/navigation";
import { DataMessage, PageHeader, Panel } from "@/components/ui/page";
import { env } from "@/lib/env";

export default async function DashboardPage({ searchParams }: Readonly<{ searchParams: Promise<{ view?: string }> }>) {
  const params = await searchParams;
  if (params.view === "operations") redirect("/operations");
  const embedUrl = env.powerBiEmbedUrl;

  return (
    <>
      <PageHeader
        title="Dashboard kinh doanh"
        description="Báo cáo Power BI được tối giản còn đúng hai trang: Tổng quan kinh doanh và Phân tích chi tiết."
        actions={embedUrl ? (
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

      <Panel className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p>Chuyển giữa hai trang bằng thanh trang ở cuối khung Power BI.</p>
          <p className="font-medium text-slate-800">1. Tổng quan kinh doanh · 2. Phân tích chi tiết</p>
        </div>
        {embedUrl ? (
          <iframe
            allow="fullscreen"
            allowFullScreen
            className="block h-[calc(100dvh-215px)] min-h-[760px] w-full border-0"
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
      </Panel>
    </>
  );
}
