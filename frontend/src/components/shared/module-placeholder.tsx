interface ModulePlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
  items: string[];
}

export function ModulePlaceholder({ eyebrow, title, description, items }: ModulePlaceholderProps) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-7 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-950">{title}</h1>
      <p className="mt-2 max-w-3xl leading-7 text-[var(--muted)]">{description}</p>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => (
          <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="text-xs font-semibold text-[var(--primary)]">0{index + 1}</span>
            <p className="mt-2 font-medium text-slate-800">{item}</p>
          </div>
        ))}
      </div>
      <p className="mt-7 border-t border-slate-100 pt-5 text-sm text-slate-500">
        Khung module đã sẵn sàng để nối API và phát triển giao diện chi tiết.
      </p>
    </section>
  );
}
