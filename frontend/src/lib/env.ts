const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const entraClientId = process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID;
const entraTenantId = process.env.NEXT_PUBLIC_ENTRA_TENANT_ID;
const entraApiScope = process.env.NEXT_PUBLIC_ENTRA_API_SCOPE;
const powerBiEmbedUrl = process.env.NEXT_PUBLIC_POWER_BI_EMBED_URL;
const useDevelopmentUser = process.env.NEXT_PUBLIC_USE_DEVELOPMENT_USER === "true";

export const env = {
  apiBaseUrl: apiBaseUrl?.replace(/\/$/, "") ?? "http://localhost:5080",
  entraClientId,
  entraTenantId,
  entraApiScope,
  powerBiEmbedUrl: powerBiEmbedUrl?.trim() || undefined,
  entraConfigured: Boolean(entraClientId && entraTenantId && entraApiScope),
  useDevelopmentUser,
} as const;
