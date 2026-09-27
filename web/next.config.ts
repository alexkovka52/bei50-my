import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  // Keep discovery inside this app when the machine has other npm projects.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
