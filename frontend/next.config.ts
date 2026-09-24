import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return [{
      source: "/backend/:path*",
      destination: "https://hotel-digital-api-mpgranji.azurewebsites.net/:path*",
    }];
  },
};

export default nextConfig;
