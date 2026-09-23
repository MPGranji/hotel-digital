"use client";

import { InteractionRequiredAuthError, PublicClientApplication, type AccountInfo } from "@azure/msal-browser";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { setAccessTokenProvider } from "@/lib/api-client";
import { LiveUpdatesProvider } from "@/features/realtime/live-updates-provider";
import { DevelopmentLogin } from "./development-login";

const localSessionKey = "hotel-digital:local-session";
const tenantId = process.env.NEXT_PUBLIC_ENTRA_TENANT_ID;
const clientId = process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID;
const apiScope = process.env.NEXT_PUBLIC_ENTRA_API_SCOPE;

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

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<AccountInfo>();
  const [authenticatedLocally, setAuthenticatedLocally] = useState(false);
  const [error, setError] = useState<string>();
  const authClient = useRef<PublicClientApplication | null>(null);
  const [localDemo, setLocalDemo] = useState(false);

  useEffect(() => {
    let active = true;
    const allowLocalDemo = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true"
      && ["localhost", "127.0.0.1"].includes(window.location.hostname);
    queueMicrotask(() => setLocalDemo(allowLocalDemo));
    if (allowLocalDemo) {
      queueMicrotask(() => {
        if (!active) return;
        setAuthenticatedLocally(window.sessionStorage.getItem(localSessionKey) === "authenticated");
        setReady(true);
      });
      return () => { active = false; };
    }

    if (!tenantId || !clientId || !apiScope) {
      queueMicrotask(() => {
        if (active) { setError("Đăng nhập nhân viên chưa được cấu hình."); setReady(true); }
      });
      return () => { active = false; };
    }

    const client = new PublicClientApplication({
      auth: { clientId, authority: `https://login.microsoftonline.com/${tenantId}`, redirectUri: window.location.origin },
      cache: { cacheLocation: "sessionStorage" },
    });
    authClient.current = client;
    void client.initialize()
      .then(() => client.handleRedirectPromise())
      .then((result) => {
        if (!active) return;
        const signedIn = result?.account ?? client.getAllAccounts()[0];
        if (signedIn) {
          client.setActiveAccount(signedIn);
          setAccount(signedIn);
          setAccessTokenProvider(async () => {
            const current = client.getActiveAccount();
            if (!current) throw new Error("Phiên đăng nhập đã kết thúc.");
            try {
              return (await client.acquireTokenSilent({ scopes: [apiScope], account: current })).accessToken;
            } catch (reason) {
              if (reason instanceof InteractionRequiredAuthError) {
                await client.acquireTokenRedirect({ scopes: [apiScope], account: current });
              }
              throw reason;
            }
          });
        }
      })
      .catch(() => { if (active) setError("Không thể khởi tạo đăng nhập. Vui lòng thử lại."); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; setAccessTokenProvider(undefined); };
  }, []);

  if (!ready) return <CenteredMessage title="Đang khởi tạo" description="Đang kiểm tra phiên đăng nhập…" />;
  if (error) return <CenteredMessage title="Chưa thể đăng nhập" description={error} />;

  if (localDemo) {
    if (!authenticatedLocally) return <DevelopmentLogin onSignedIn={() => {
      window.sessionStorage.setItem(localSessionKey, "authenticated");
      setAuthenticatedLocally(true);
    }} />;
    return <SessionContext.Provider value={{
      displayName: "Quản trị viên thử nghiệm", isDevelopment: true,
      signOut: async () => { window.sessionStorage.removeItem(localSessionKey); setAuthenticatedLocally(false); },
    }}><LiveUpdatesProvider>{children}</LiveUpdatesProvider></SessionContext.Provider>;
  }

  if (!account) return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--background)] px-6 text-center">
    <h1 className="text-xl font-semibold">Đăng nhập nhân viên</h1>
    <p className="text-sm text-[var(--muted)]">Dùng tài khoản cơ quan đã được cấp quyền truy cập khách sạn.</p>
    <button className="rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-white" onClick={() => void authClient.current?.loginRedirect({ scopes: [apiScope!] })} type="button">Đăng nhập với Microsoft</button>
  </main>;

  return <SessionContext.Provider value={{
    displayName: account.name ?? account.username,
    email: account.username,
    isDevelopment: false,
    signOut: async () => { setAccessTokenProvider(undefined); await authClient.current?.logoutRedirect({ account }); },
  }}><LiveUpdatesProvider>{children}</LiveUpdatesProvider></SessionContext.Provider>;
}

function CenteredMessage({ title, description }: Readonly<{ title: string; description: string }>) {
  return <main className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-6 text-center">
    <div><h1 className="text-xl font-semibold text-[var(--foreground)]">{title}</h1><p className="mt-2 text-sm text-[var(--muted)]">{description}</p></div>
  </main>;
}
