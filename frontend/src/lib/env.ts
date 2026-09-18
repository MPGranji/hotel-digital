const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const powerBiEmbedUrl =
  process.env.NEXT_PUBLIC_POWER_BI_PUBLIC_URL?.trim() ||
  "https://app.powerbi.com/view?key=0cb797bf-3216-4a00-b090-7e7b8e26f942";

export const env = {
  apiBaseUrl: apiBaseUrl?.replace(/\/$/, "") ?? "http://localhost:5080",
  powerBiEmbedUrl,
} as const;
