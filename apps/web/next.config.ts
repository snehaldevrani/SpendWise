import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude the v0 source snapshot from webpack watching and output tracing
  watchOptions: {
    ignored: ["**/node_modules", "**/spend-wise-app-build"],
  },
  outputFileTracingExcludes: {
    "*": ["./spend-wise-app-build/**"],
  },
};

export default nextConfig;
