import type { NextConfig } from "next";

const apiOrigin = (process.env.HOTEL_API_ORIGIN?.trim() || "https://hotel-digital-api-mpgranji.azurewebsites.net").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return [{
      source: "/backend/:path*",
      destination: `${apiOrigin}/:path*`,
    }];
  },
};

export default nextConfig;
