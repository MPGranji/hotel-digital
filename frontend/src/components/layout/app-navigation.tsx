"use client";

import Link from "next/link";
import { navigationGroups } from "@/config/navigation";

const groupAccents = ["#9bd5c8", "#e6bf8c", "#adc5e7"];

export function AppNavigation({
  pathname,
  collapsed,
  onNavigate,
}: Readonly<{ pathname: string; collapsed: boolean; onNavigate: () => void }>) {
  return (
    <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto px-3 pb-6 pt-5">
      {navigationGroups.map((group, index) => (
        <div className="mb-5" key={group.label}>
          <p className={`flex items-center gap-2 px-3 pb-2 text-xs font-semibold tracking-[0.015em] text-white/85 ${collapsed ? "lg:sr-only" : ""}`}>
            <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: groupAccents[index] }} />{group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-11 items-center gap-3 rounded-lg border-l-[3px] px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${
                    active
                      ? "bg-[var(--sidebar-panel-active)] font-semibold text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/8%)]"
                      : "font-medium text-[#c8d7db] hover:bg-white/10 hover:text-white"
                  } ${collapsed ? "lg:justify-center" : ""}`}
                  href={item.href}
                  key={item.href}
                  onClick={onNavigate}
                  style={{ borderLeftColor: active ? groupAccents[index] : "transparent" }}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon aria-hidden="true" className="shrink-0" color={active ? groupAccents[index] : undefined} size={18} strokeWidth={active ? 2.2 : 1.8} />
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
