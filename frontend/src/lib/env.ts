const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const powerBiEmbedUrl = "https://app.powerbi.com/view?r=eyJrIjoiNjNiYWY2NWItMzIwNC00NjMwLTk2NGItZTRkMzkxZmQzN2RjIiwidCI6IjZhYzJhZDA2LTY5MmMtNDY2My1iN2FmLWE5ZmYyYTg2NmQwYyIsImMiOjEwfQ%3D%3D&pageName=34db4ea7000e0452673c";
export const env = {
  apiBaseUrl: apiBaseUrl?.replace(/\/$/, "") ?? "http://localhost:5080",
  powerBiEmbedUrl,
} as const;
