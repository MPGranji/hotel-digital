const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const configuredEmbedUrl = process.env.NEXT_PUBLIC_POWER_BI_EMBED_URL?.trim();
function securePowerBiEmbedUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "app.powerbi.com"
      && url.pathname === "/reportEmbed"
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.searchParams.get("reportId") ?? "")
      ? url.toString() : undefined;
  } catch { return undefined; }
}
const powerBiEmbedUrl = securePowerBiEmbedUrl(configuredEmbedUrl);

export const env = {
  apiBaseUrl: apiBaseUrl?.replace(/\/$/, "") ?? "http://localhost:5080",
  powerBiEmbedUrl,
} as const;
