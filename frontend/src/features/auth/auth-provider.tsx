"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DevelopmentLogin } from "./development-login";

const localSessionKey = "hotel-digital:local-session";

interface SessionValue {
  displayName: string;
  email?: string;
  isDevelopment: boolean;
  signOut?: () => Promise<void>;
}

const SessionContext = createContext<SessionValue>({
  displayName: "Quản trị viên",
  isDevelopment: true,
});

export function useSession() {
  return useContext(SessionContext);
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setAuthenticated(window.sessionStorage.getItem(localSessionKey) === "authenticated");
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  if (!ready) {
    return <CenteredMessage title="Đang khởi tạo" description="Đang chuẩn bị phiên đăng nhập…" />;
  }

  if (!authenticated) {
    return (
      <DevelopmentLogin
        onSignedIn={() => {
          window.sessionStorage.setItem(localSessionKey, "authenticated");
          setAuthenticated(true);
        }}
      />
    );
  }

  return (
    <SessionContext.Provider value={{
      displayName: "Quản trị viên",
      isDevelopment: true,
      signOut: async () => {
        window.sessionStorage.removeItem(localSessionKey);
        setAuthenticated(false);
      },
    }}>
      {children}
    </SessionContext.Provider>
  );
}

function CenteredMessage({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-6 text-center">
      <div>
        <h1 className="text-xl font-semibold text-[var(--foreground)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
      </div>
    </main>
  );
}
