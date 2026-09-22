"use client";

import Link from "next/link";
import { navigationGroups } from "@/config/navigation";

export function AppNavigation({
  pathname,
  collapsed,
  onNavigate,
}: Readonly<{ pathname: string; collapsed: boolean; onNavigate: () => void }>) {
  return (
    <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto px-3 pb-6 pt-5">
      {navigationGroups.map((group) => (
        <div className="mb-6" key={group.label}>
          <p className={`px-3 pb-2 text-[11px] font-semibold tracking-[0.08em] text-[var(--muted)] ${collapsed ? "lg:sr-only" : ""}`}>
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${
                    active
                      ? "bg-[var(--nav-active)] text-[var(--primary-strong)]"
                      : "text-[var(--nav-text)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                  } ${collapsed ? "lg:justify-center" : ""}`}
                  href={item.href}
                  key={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon aria-hidden="true" className="shrink-0" size={18} strokeWidth={active ? 2.1 : 1.8} />
                  <span className={collapsed ? "lg:sr-only" : ""}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
