import { env } from "@/lib/env";
import type { ProblemDetails } from "@/types/api";

type AccessTokenProvider = () => Promise<string>;

let accessTokenProvider: AccessTokenProvider | undefined;

export function setAccessTokenProvider(provider?: AccessTokenProvider) {
  accessTokenProvider = provider;
}

export function getApiProblem(error: unknown): ProblemDetails | undefined {
  if (error instanceof ApiError && typeof error.detail === "object" && error.detail !== null) {
    return error.detail as ProblemDetails;
  }
  return undefined;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "Kết nối đang chậm. Bạn thử lại sau ít phút nhé.";
  }
  return getApiProblem(error)?.detail ?? fallback;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: unknown,
  ) {
    super(`API request failed with status ${status}`);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await accessTokenProvider?.();
  const isRead = !init?.method || init.method.toUpperCase() === "GET";
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    signal: init?.signal ?? (isRead ? AbortSignal.timeout(15_000) : undefined),
    headers: {
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    const detail = contentType?.includes("application/json") ? await response.json() : await response.text();
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
