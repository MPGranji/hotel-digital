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
        title="Báo cáo quản trị"
        description="Xem tình hình phòng và kết quả kinh doanh. Bạn có thể chuyển giữa hai trang ngay trong báo cáo."
        actions={embedUrl ? (
          <a
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--primary)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--surface-muted)]"
            href={embedUrl}
            rel="noreferrer"
            target="_blank"
          >
            Mở báo cáo toàn màn hình
            <ExternalLink aria-hidden="true" size={16} />
          </a>
        ) : undefined}
      />

      <Panel className="overflow-hidden rounded-2xl p-0 shadow-[0_18px_45px_rgba(36,52,77,0.08)]">
        {embedUrl ? (
          <iframe
            allow="fullscreen"
            allowFullScreen
            className="block h-[calc(100dvh-220px)] min-h-[720px] w-full border-0 bg-[var(--surface)]"
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
            src={embedUrl}
            title="Dashboard quản trị khách sạn trên Power BI"
          />
        ) : (
          <div className="p-5">
            <DataMessage
              title="Báo cáo chưa sẵn sàng"
              description="Bạn thử mở lại sau hoặc kiểm tra đường dẫn báo cáo."
            />
          </div>
        )}
      </Panel>
    </>
  );
}
