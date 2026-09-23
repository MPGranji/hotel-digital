"use client";

import { LogOut, UserRound } from "lucide-react";
import { useSession } from "./auth-provider";

export function UserMenu({ collapsed = false }: Readonly<{ collapsed?: boolean }>) {
  const session = useSession();

  return (
    <div className={`flex min-w-0 items-center gap-3 ${collapsed ? "lg:flex-col lg:gap-2" : ""}`}>
      <div aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white"><UserRound size={18} /></div>
      <div className={`min-w-0 flex-1 ${collapsed ? "lg:sr-only" : ""}`}>
        <p className="truncate text-sm font-semibold text-white">{session.displayName}</p>
        <p className="truncate text-xs text-[var(--sidebar-panel-muted)]">{session.email ?? "Tài khoản quản trị"}</p>
      </div>
      {session.signOut ? (
        <button
          aria-label="Đăng xuất"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--sidebar-panel-muted)] transition-colors hover:bg-white/10 hover:text-white"
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
