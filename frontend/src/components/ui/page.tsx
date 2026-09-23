import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: Readonly<{ title: string; description?: string; actions?: ReactNode }>) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 border-b border-[var(--border)] pb-6 md:flex-row md:items-end">
      <div>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-[var(--foreground)] sm:text-[2rem]">{title}</h1>
        {description ? <p className="mt-2 max-w-[68ch] text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ children, className = "" }: Readonly<{ children: ReactNode; className?: string }>) {
  return <section className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function SectionTitle({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <h2 className="mb-5 border-b border-[var(--border)] border-l-[3px] border-l-[var(--accent)] bg-[var(--sidebar)] px-3 py-3 text-[1.05rem] font-semibold tracking-tight text-[var(--primary-strong)]">{children}</h2>
  );
}

export function DataMessage({
  title,
  description,
  action,
}: Readonly<{ title: string; description?: string; action?: ReactNode }>) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--sidebar)] px-5 py-10 text-center">
      <p className="font-semibold text-[var(--foreground)]">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
