import { ExternalLink } from "lucide-react";
import { DataMessage, PageHeader, Panel } from "@/components/ui/page";
import { env } from "@/lib/env";

export default function DashboardPage() {
  const embedUrl = env.powerBiEmbedUrl;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Báo cáo Power BI tổng hợp công suất phòng, doanh thu, kênh đặt phòng và đặc điểm khách lưu trú."
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
        {embedUrl ? (
          <iframe
            allow="fullscreen"
            allowFullScreen
            className="block min-h-[680px] w-full border-0"
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
