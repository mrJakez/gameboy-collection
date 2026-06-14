import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    domains: ["localhost"],
    unoptimized: true,
  },
};

export default nextConfig;
