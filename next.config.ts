import type { NextConfig } from "next";

const nicepayHosts = [
  "https://pay.nicepay.co.kr",
  "https://start-pay.nicepay.co.kr",
  "https://api.nicepay.co.kr",
].join(" ");

const csp =
  `default-src 'self'; ` +
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${nicepayHosts}; ` +
  `style-src 'self' 'unsafe-inline'; ` +
  `connect-src 'self' ${nicepayHosts} https://*.vercel.app; ` +
  `frame-src ${nicepayHosts}; ` +
  `img-src 'self' data: blob: https:; ` +
  `font-src 'self' data:;`;

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
