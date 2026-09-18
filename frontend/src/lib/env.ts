const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const powerBiEmbedUrl = process.env.NEXT_PUBLIC_POWER_BI_EMBED_URL;

export const env = {
  apiBaseUrl: apiBaseUrl?.replace(/\/$/, "") ?? "http://localhost:5080",
  powerBiEmbedUrl: powerBiEmbedUrl?.trim() || undefined,
} as const;
