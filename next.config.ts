import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["linkedom", "@mozilla/readability"],
};

export default nextConfig;
