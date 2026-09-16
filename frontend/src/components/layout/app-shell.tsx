import type { ReactNode } from "react";
import { UserMenu } from "@/features/auth/user-menu";
import { AppNavigation } from "./app-navigation";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1480px] items-center justify-between px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Hotel Digital</p>
            <p className="text-sm text-[var(--muted)]">Vận hành khách sạn</p>
          </div>
          <UserMenu />
        </div>
        <AppNavigation />
      </header>
      <main className="mx-auto max-w-[1480px] px-5 py-8">{children}</main>
    </div>
  );
}
