import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: Readonly<{ title: string; description?: string; actions?: ReactNode }>) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ children, className = "" }: Readonly<{ children: ReactNode; className?: string }>) {
  return <section className={`rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

export function SectionTitle({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <h2 className="mb-4 border-b border-slate-200 pb-3 text-base font-semibold text-slate-900">{children}</h2>
  );
}

export function DataMessage({
  title,
  description,
  action,
}: Readonly<{ title: string; description?: string; action?: ReactNode }>) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 px-5 py-10 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
