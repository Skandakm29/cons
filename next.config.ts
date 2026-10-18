import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  // ESLint is not part of the base install; type-checking still runs on build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
