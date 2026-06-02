import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Required in monorepos: lets Next.js trace dependencies from the workspace root
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Disable ESLint during production builds — linting runs in CI separately
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript type-check during builds — tsc runs in CI separately
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
