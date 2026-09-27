import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep discovery inside this app when the machine has other npm projects.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
