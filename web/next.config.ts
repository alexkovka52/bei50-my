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
  // Dev only: proxy /tiles/* to a local static server (nginx serves /tiles/ in production).
  async rewrites() {
    const origin = process.env.TILES_DEV_ORIGIN;
    return origin ? [{ source: "/tiles/:path*", destination: `${origin}/:path*` }] : [];
  },
};

export default nextConfig;
