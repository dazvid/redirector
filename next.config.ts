import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pins the file-tracing root to this project so the standalone build
  // output structure is deterministic — without it, a lockfile in any
  // parent directory (host machine or CI) can make Next misdetect a
  // monorepo root and nest the output a few directories deep.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
