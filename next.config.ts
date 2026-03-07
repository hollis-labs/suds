import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" is for Docker/self-hosted; Vercel handles this automatically
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
};

export default nextConfig;
