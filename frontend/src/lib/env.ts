const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const powerBiEmbedUrl =
  process.env.NEXT_PUBLIC_POWER_BI_PUBLIC_URL?.trim() ||
  "https://app.powerbi.com/view?r=eyJrIjoiMGNiNzk3YmYtMzIxNi00YTAwLWIwOTAtN2U3YjhlMjZmOTQyIiwidCI6IjZhYzJhZDA2LTY5MmMtNDY2My1iN2FmLWE5ZmYyYTg2NmQwYyJ9";

export const env = {
  apiBaseUrl: apiBaseUrl?.replace(/\/$/, "") ?? "http://localhost:5080",
  powerBiEmbedUrl,
} as const;
