"use client";

export function PowerBiReport({ embedUrl }: Readonly<{ embedUrl: string }>) {
  return <iframe
    allow="fullscreen"
    allowFullScreen
    className="mt-4 block h-[70dvh] min-h-[520px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)]"
    loading="lazy"
    referrerPolicy="strict-origin-when-cross-origin"
    src={embedUrl}
    title="Báo cáo Power BI"
  />;
}
