import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every response.
 *
 * The Content-Security-Policy keeps `script-src`/`style-src` as
 * `'unsafe-inline'` because Next's App Router injects inline hydration
 * scripts (and there's a small inline theme script in layout.tsx); tightening
 * that to a nonce-based policy is a worthwhile follow-up. The rest of the
 * policy is strict: no plugins, no framing, self-only base URI and form
 * actions. `img-src` allows arbitrary https/data because the directory
 * renders remote link-preview thumbnails.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' https: data:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Pins the file-tracing root to this project so the standalone build
  // output structure is deterministic — without it, a lockfile in any
  // parent directory (host machine or CI) can make Next misdetect a
  // monorepo root and nest the output a few directories deep.
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
