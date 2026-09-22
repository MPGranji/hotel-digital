"use client";

import { LogOut, UserRound } from "lucide-react";
import { useSession } from "./auth-provider";

export function UserMenu({ collapsed = false }: Readonly<{ collapsed?: boolean }>) {
  const session = useSession();

  return (
    <div className={`flex min-w-0 items-center gap-3 ${collapsed ? "lg:flex-col lg:gap-2" : ""}`}>
      <div aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--nav-active)] text-[var(--primary)]"><UserRound size={18} /></div>
      <div className={`min-w-0 flex-1 ${collapsed ? "lg:sr-only" : ""}`}>
        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{session.displayName}</p>
        <p className="truncate text-xs text-[var(--muted)]">{session.isDevelopment ? "Tài khoản quản trị" : session.email}</p>
      </div>
      {session.signOut ? (
        <button
          aria-label="Đăng xuất"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          onClick={() => void session.signOut?.()}
          title="Đăng xuất"
          type="button"
        >
          <LogOut aria-hidden="true" size={18} />
        </button>
      ) : null}
    </div>
  );
}
