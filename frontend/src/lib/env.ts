const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const configuredEmbedUrl = process.env.NEXT_PUBLIC_POWER_BI_EMBED_URL?.trim();
const publicPowerBiEmbedUrl = "https://app.powerbi.com/view?r=eyJrIjoiNjNiYWY2NWItMzIwNC00NjMwLTk2NGItZTRkMzkxZmQzN2RjIiwidCI6IjZhYzJhZDA2LTY5MmMtNDY2My1iN2FmLWE5ZmYyYTg2NmQwYyIsImMiOjEwfQ%3D%3D";
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
const powerBiEmbedUrl = securePowerBiEmbedUrl(configuredEmbedUrl) ?? publicPowerBiEmbedUrl;

export const env = {
  apiBaseUrl: apiBaseUrl?.replace(/\/$/, "") ?? "http://localhost:5080",
  powerBiEmbedUrl,
} as const;
