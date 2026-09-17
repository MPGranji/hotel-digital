"use client";

import { LogOut } from "lucide-react";
import { useSession } from "./auth-provider";

export function UserMenu() {
  const session = useSession();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium text-slate-800">{session.displayName}</p>
        <p className="text-xs text-slate-500">{session.isDevelopment ? "Quản trị hệ thống" : session.email}</p>
      </div>
      {session.signOut ? (
        <button
          aria-label="Đăng xuất"
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-950"
          onClick={() => void session.signOut?.()}
          title="Đăng xuất"
          type="button"
        >
          <LogOut aria-hidden="true" size={17} />
        </button>
      ) : null}
    </div>
  );
}
