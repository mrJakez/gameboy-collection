import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["10.10.10.165"],
  images: {
    domains: ["localhost"],
    unoptimized: true,
  },
};

export default nextConfig;
