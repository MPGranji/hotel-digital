export function PowerBiReport({ embedUrl }: Readonly<{ embedUrl: string }>) {
  return <iframe
    allow="fullscreen"
    allowFullScreen
    className="block h-[75dvh] min-h-[520px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] lg:aspect-video lg:h-auto lg:min-h-0"
    loading="eager"
    referrerPolicy="strict-origin-when-cross-origin"
    src={embedUrl}
    title="Báo cáo Power BI công khai"
  />;
}
