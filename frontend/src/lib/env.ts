const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const apiBaseUrl = typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app")
  ? "/backend"
  : configuredApiBaseUrl?.replace(/\/$/, "") ?? "http://localhost:5080";
const powerBiEmbedUrl = "https://app.powerbi.com/view?r=eyJrIjoiNjNiYWY2NWItMzIwNC00NjMwLTk2NGItZTRkMzkxZmQzN2RjIiwidCI6IjZhYzJhZDA2LTY5MmMtNDY2My1iN2FmLWE5ZmYyYTg2NmQwYyIsImMiOjEwfQ%3D%3D&pageName=34db4ea7000e0452673c";
export const env = {
  apiBaseUrl,
  powerBiEmbedUrl,
} as const;
