import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  // Keep discovery inside this app when the machine has other npm projects.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  // Imagery comes from pre-built tiles; skipping the optimizer keeps sharp/libvips out of the request path.
  images: { unoptimized: true },
};

export default nextConfig;
