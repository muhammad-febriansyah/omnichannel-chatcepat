import type { NextConfig } from "next";

// Security headers — semua route. CSP sengaja minimal (frame-ancestors saja) supaya
// tak memblok inline style/script Next; perketat script-src bila sudah pakai nonce.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  // Sembunyikan badge "N" Next.js (indikator dev) di pojok layar.
  devIndicators: false,
  experimental: {
    // Middleware buffers request bodies only up to this size (default 10 MB); chat
    // attachments go up to 16 MB, so larger uploads would arrive truncated.
    proxyClientMaxBodySize: "20mb",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
