const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const entraClientId = process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID;
const entraTenantId = process.env.NEXT_PUBLIC_ENTRA_TENANT_ID;
const entraApiScope = process.env.NEXT_PUBLIC_ENTRA_API_SCOPE;
const useDevelopmentUser = process.env.NEXT_PUBLIC_USE_DEVELOPMENT_USER === "true";

export const env = {
  apiBaseUrl: apiBaseUrl?.replace(/\/$/, "") ?? "http://localhost:5080",
  entraClientId,
  entraTenantId,
  entraApiScope,
  entraConfigured: Boolean(entraClientId && entraTenantId && entraApiScope),
  useDevelopmentUser,
} as const;
