"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/config/navigation";

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Điều hướng chính" className="mx-auto flex max-w-[1480px] gap-1 overflow-x-auto px-5">
      {navigationItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              active
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-slate-600 hover:text-slate-950"
            }`}
          >
            <Icon aria-hidden="true" size={16} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
