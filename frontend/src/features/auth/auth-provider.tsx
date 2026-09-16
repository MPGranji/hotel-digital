"use client";

import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setAccessTokenProvider } from "@/lib/api-client";
import { env } from "@/lib/env";

interface SessionValue {
  displayName: string;
  email?: string;
  isDevelopment: boolean;
  signOut?: () => Promise<void>;
}

const SessionContext = createContext<SessionValue>({
  displayName: "Người dùng phát triển",
  isDevelopment: true,
});

export function useSession() {
  return useContext(SessionContext);
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [client, setClient] = useState<PublicClientApplication>();
  const [initializationError, setInitializationError] = useState<string>();

  useEffect(() => {
    if (!env.entraConfigured) return;

    const instance = new PublicClientApplication({
      auth: {
        clientId: env.entraClientId!,
        authority: `https://login.microsoftonline.com/${env.entraTenantId}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: "sessionStorage" },
    });

    void instance
      .initialize()
      .then(() => instance.handleRedirectPromise())
      .then((result) => {
        if (result?.account) instance.setActiveAccount(result.account);
        setClient(instance);
      })
      .catch(() => setInitializationError("Không thể khởi tạo đăng nhập Microsoft Entra ID."));
  }, []);

  if (!env.entraConfigured) {
    if (process.env.NODE_ENV === "production") {
      return <ConfigurationError />;
    }

    return (
      <SessionContext.Provider value={{ displayName: "Người dùng phát triển", isDevelopment: true }}>
        {children}
      </SessionContext.Provider>
    );
  }

  if (initializationError) return <CenteredMessage title="Không thể đăng nhập" description={initializationError} />;
  if (!client) return <CenteredMessage title="Đang khởi tạo" description="Đang kết nối Microsoft Entra ID…" />;

  return (
    <MsalProvider instance={client}>
      <AuthenticatedContent client={client}>{children}</AuthenticatedContent>
    </MsalProvider>
  );
}

function AuthenticatedContent({
  client,
  children,
}: Readonly<{ client: PublicClientApplication; children: ReactNode }>) {
  const [account, setAccount] = useState<AccountInfo | null>(
    client.getActiveAccount() ?? client.getAllAccounts()[0] ?? null,
  );
  const [tokenReady, setTokenReady] = useState(false);
  const scope = env.entraApiScope!;

  useEffect(() => {
    if (!account) {
      setAccessTokenProvider(undefined);
      return;
    }

    client.setActiveAccount(account);
    setAccessTokenProvider(async () => {
      try {
        return (await client.acquireTokenSilent({ account, scopes: [scope] })).accessToken;
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          return (await client.acquireTokenPopup({ account, scopes: [scope] })).accessToken;
        }
        throw error;
      }
    });
    queueMicrotask(() => setTokenReady(true));

    return () => setAccessTokenProvider(undefined);
  }, [account, client, scope]);

  const session = useMemo<SessionValue>(() => ({
    displayName: account?.name ?? "Người dùng nội bộ",
    email: account?.username,
    isDevelopment: false,
    signOut: async () => {
      await client.logoutPopup({ account: account ?? undefined });
      setTokenReady(false);
      setAccount(null);
    },
  }), [account, client]);

  if (!account) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-[var(--primary)]">HOTEL DIGITAL</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-950">Đăng nhập để tiếp tục</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sử dụng tài khoản Microsoft được cấp quyền cho hệ thống vận hành khách sạn.
          </p>
          <button
            className="mt-6 w-full rounded-lg bg-[var(--primary)] px-4 py-3 font-semibold text-white hover:bg-[var(--primary-strong)]"
            onClick={() => {
              setTokenReady(false);
              void client.loginPopup({ scopes: [scope] }).then((result) => setAccount(result.account));
            }}
            type="button"
          >
            Đăng nhập bằng Microsoft
          </button>
        </section>
      </main>
    );
  }

  if (!tokenReady) return <CenteredMessage title="Đang xác thực" description="Đang chuẩn bị phiên làm việc…" />;

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

function ConfigurationError() {
  return (
    <CenteredMessage
      title="Ứng dụng chưa được cấu hình đăng nhập"
      description="Vui lòng cấu hình Client ID, Tenant ID và API scope của Microsoft Entra ID."
    />
  );
}

function CenteredMessage({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center">
      <div>
        <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </div>
    </main>
  );
}
