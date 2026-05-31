import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Required in monorepos: lets Next.js trace dependencies from the workspace root
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
