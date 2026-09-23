"use client";

import { HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getAccessToken } from "@/lib/api-client";
import { env } from "@/lib/env";

const LiveRevisionContext = createContext(0);
type LiveStatus = "connecting" | "connected" | "reconnecting" | "offline";
const LiveStatusContext = createContext<LiveStatus>("connecting");

export function useLiveRevision() {
  return useContext(LiveRevisionContext);
}

export function useLiveStatus() {
  return useContext(LiveStatusContext);
}

export function LiveUpdatesProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<LiveStatus>("connecting");

  useEffect(() => {
    let disposed = false;
    let hasConnected = false;
    let retryCount = 0;
    let retryTimer: number | undefined;
    let refreshTimer: number | undefined;
    const connection = new HubConnectionBuilder()
      .withUrl(`${env.apiBaseUrl}/hubs/updates`, {
        accessTokenFactory: async () => (await getAccessToken()) ?? "",
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: ({ previousRetryCount }) =>
          Math.min(30_000, 1_000 * 2 ** Math.min(previousRetryCount, 5)),
      })
      .configureLogging(LogLevel.None)
      .build();

    function invalidate() {
      if (disposed || document.hidden || refreshTimer !== undefined) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined;
        if (!disposed) setRevision((value) => value + 1);
      }, 350);
    }

    function scheduleRetry() {
      if (disposed || retryTimer !== undefined) return;
      const delay = Math.min(30_000, 1_000 * 2 ** Math.min(retryCount++, 5))
        + Math.floor(Math.random() * 500);
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void start();
      }, delay);
    }

    async function start() {
      if (disposed || connection.state !== HubConnectionState.Disconnected) return;
      try {
        await connection.start();
        if (disposed) return;
        retryCount = 0;
        setStatus("connected");
        if (hasConnected) invalidate();
        hasConnected = true;
      } catch {
        if (!disposed) {
          setStatus("offline");
          scheduleRetry();
        }
      }
    }

    connection.on("DataChanged", invalidate);
    connection.onreconnecting(() => { if (!disposed) setStatus("reconnecting"); });
    connection.onreconnected(() => { if (!disposed) { setStatus("connected"); invalidate(); } });
    connection.onclose(() => {
      if (!disposed) {
        setStatus("offline");
        scheduleRetry();
      }
    });
    void start();

    function reconcileWhenVisible() {
      if (!document.hidden) invalidate();
    }
    const reconcileTimer = window.setInterval(reconcileWhenVisible, 120_000);
    window.addEventListener("focus", reconcileWhenVisible);
    document.addEventListener("visibilitychange", reconcileWhenVisible);

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(refreshTimer);
      window.clearInterval(reconcileTimer);
      window.removeEventListener("focus", reconcileWhenVisible);
      document.removeEventListener("visibilitychange", reconcileWhenVisible);
      void connection.stop();
    };
  }, []);

  return <LiveStatusContext.Provider value={status}><LiveRevisionContext.Provider value={revision}>{children}</LiveRevisionContext.Provider></LiveStatusContext.Provider>;
}
