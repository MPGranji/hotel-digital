"use client";

import { BedDouble, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { navigationItems } from "@/config/navigation";
import { UserMenu } from "@/features/auth/user-menu";
import { AppNavigation } from "./app-navigation";

const sidebarPreferenceKey = "hotel-digital:sidebar-collapsed";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousPath = useRef(pathname);
  const currentPage = navigationItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  useEffect(() => {
    queueMicrotask(() => setCollapsed(window.localStorage.getItem(sidebarPreferenceKey) === "true"));
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    function closeWhenWide(event: MediaQueryListEvent) {
      if (event.matches) setMobileOpen(false);
    }
    desktop.addEventListener("change", closeWhenWide);
    return () => desktop.removeEventListener("change", closeWhenWide);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
      if (event.key !== "Tab") return;
      const focusable = [...(sidebarRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [])]
        .filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (pathname !== previousPath.current) {
      previousPath.current = pathname;
      document.getElementById("main-content")?.focus({ preventScroll: true });
    }
  }, [pathname]);

  function closeMobileMenu() {
    setMobileOpen(false);
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  }

  function toggleCollapsed() {
    setCollapsed((current) => {
      window.localStorage.setItem(sidebarPreferenceKey, String(!current));
      return !current;
    });
  }

  return (
    <div className="min-h-dvh">
      <a className="skip-link" href="#main-content">Đến nội dung chính</a>
      {mobileOpen ? <button aria-label="Đóng menu" className="fixed inset-0 z-40 bg-[#10252f]/60 lg:hidden" onClick={closeMobileMenu} type="button" /> : null}

      <aside aria-label={mobileOpen ? "Menu chính" : undefined} aria-modal={mobileOpen ? true : undefined} className={`app-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-[var(--sidebar-panel)] transition-[width,transform] duration-200 lg:translate-x-0 lg:visible ${collapsed ? "lg:w-20" : "lg:w-64"} ${mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"}`} ref={sidebarRef} role={mobileOpen ? "dialog" : undefined}>
        <div className={`flex min-h-20 items-center gap-3 border-b border-white/10 px-5 ${collapsed ? "lg:justify-center lg:px-2" : ""}`}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/10" aria-hidden="true"><BedDouble size={21} strokeWidth={1.8} /></div>
          <div className={`min-w-0 ${collapsed ? "lg:sr-only" : ""}`}>
            <p className="truncate text-[15px] font-semibold tracking-tight text-white">Hotel Digital</p>
            <p className="truncate text-xs text-[var(--sidebar-panel-muted)]">Không gian làm việc</p>
          </div>
          <button aria-label="Đóng menu" className="ml-auto flex size-9 items-center justify-center rounded-lg text-[var(--sidebar-panel-muted)] hover:bg-white/10 hover:text-white lg:hidden" onClick={closeMobileMenu} ref={closeButtonRef} type="button"><X size={19} /></button>
        </div>

        <AppNavigation collapsed={collapsed} onNavigate={() => setMobileOpen(false)} pathname={pathname} />

        <div className={`border-t border-white/10 px-4 py-4 ${collapsed ? "lg:px-2" : ""}`}>
          <div className={collapsed ? "lg:flex lg:justify-center" : ""}><UserMenu collapsed={collapsed} /></div>
          <button
            aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
            className={`mt-3 hidden min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-[var(--sidebar-panel-muted)] transition-colors hover:bg-white/10 hover:text-white lg:flex ${collapsed ? "lg:justify-center" : ""}`}
            onClick={toggleCollapsed}
            type="button"
          >
            {collapsed ? <ChevronRight aria-hidden="true" size={18} /> : <ChevronLeft aria-hidden="true" size={18} />}
            {!collapsed ? <span>Thu gọn menu</span> : null}
          </button>
        </div>
      </aside>

      <div className={`min-w-0 transition-[padding] duration-200 ${collapsed ? "lg:pl-20" : "lg:pl-64"}`} inert={mobileOpen}>
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-[var(--border)] bg-white/90 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <button aria-label="Mở menu" className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] lg:hidden" onClick={() => setMobileOpen(true)} ref={menuButtonRef} type="button"><Menu size={20} /></button>
          <span className="text-xs font-medium text-[var(--muted)]">Không gian làm việc</span>
          <ChevronRight aria-hidden="true" className="text-[var(--border-strong)]" size={14} />
          <span className="truncate text-sm font-semibold text-[var(--foreground)]">{currentPage?.label ?? "Hotel Digital"}</span>
        </header>
        <main className={`mx-auto min-w-0 px-4 pb-12 pt-7 sm:px-6 lg:px-8 ${pathname === "/dashboard" ? "max-w-[1800px]" : "max-w-[1560px]"} ${pathname === "/room-status" ? "xl:h-[calc(100dvh-4rem)] xl:overflow-hidden xl:py-4" : ""}`} id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
