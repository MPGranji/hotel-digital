"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setAccessTokenProvider } from "@/lib/api-client";
import { LiveUpdatesProvider } from "@/features/realtime/live-updates-provider";
import { Login } from "./login";

const sessionKey = "hotel-digital:session";
type Session = { accessToken: string; displayName: string };

interface SessionValue {
  displayName: string;
  email?: string;
  isDevelopment: boolean;
  signOut?: () => Promise<void>;
}

const SessionContext = createContext<SessionValue>({ displayName: "", isDevelopment: false });

export function useSession() {
  return useContext(SessionContext);
}

function readSession(): Session | undefined {
  try {
    const value = window.sessionStorage.getItem(sessionKey);
    if (!value) return undefined;
    const session = JSON.parse(value) as Session;
    const payload = JSON.parse(atob(session.accessToken.split(".")[1])) as { exp?: number };
    if (typeof payload.exp === "number" && payload.exp * 1000 > Date.now()) return session;
  } catch { /* Invalid sessions are cleared below. */ }
  window.sessionStorage.removeItem(sessionKey);
  return undefined;
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session>();

  useEffect(() => {
    const saved = readSession();
    setAccessTokenProvider(saved ? async () => saved.accessToken : undefined);
    queueMicrotask(() => { setSession(saved); setReady(true); });
    return () => setAccessTokenProvider(undefined);
  }, []);

  useEffect(() => {
    if (!session) return;
    const expiresAt = (JSON.parse(atob(session.accessToken.split(".")[1])) as { exp: number }).exp * 1000;
    const timer = window.setTimeout(() => {
      window.sessionStorage.removeItem(sessionKey);
      setAccessTokenProvider(undefined);
      setSession(undefined);
    }, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [session]);

  if (!ready) return <main className="flex min-h-dvh items-center justify-center">Đang kiểm tra phiên đăng nhập…</main>;
  if (!session) return <Login onSignedIn={(signedIn) => {
    window.sessionStorage.setItem(sessionKey, JSON.stringify(signedIn));
    setAccessTokenProvider(async () => signedIn.accessToken);
    setSession(signedIn);
  }} />;

  return <SessionContext.Provider value={{
    displayName: session.displayName,
    isDevelopment: false,
    signOut: async () => {
      window.sessionStorage.removeItem(sessionKey);
      setAccessTokenProvider(undefined);
      setSession(undefined);
    },
  }}><LiveUpdatesProvider>{children}</LiveUpdatesProvider></SessionContext.Provider>;
}
