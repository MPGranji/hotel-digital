const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const powerBiEmbedUrl =
  process.env.NEXT_PUBLIC_POWER_BI_PUBLIC_URL?.trim() ||
  "https://app.powerbi.com/view?r=eyJrIjoiN2FjYjg3OGUtNDU5YS00OTgwLThkZjktZWMyNGRlZDY2ZmU3IiwidCI6IjZhYzJhZDA2LTY5MmMtNDY2My1iN2FmLWE5ZmYyYTg2NmQwYyIsImMiOjEwfQ%3D%3D&pageName=34db4ea7000e0452673c";

export const env = {
  apiBaseUrl: apiBaseUrl?.replace(/\/$/, "") ?? "http://localhost:5080",
  powerBiEmbedUrl,
} as const;
