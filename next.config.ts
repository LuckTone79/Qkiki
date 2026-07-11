import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const isProduction = process.env.NODE_ENV === "production";

// The app serves no third-party scripts; next/font self-hosts fonts at build
// time, so every source can stay first-party. `unsafe-inline` covers Next.js
// bootstrap inline scripts; `unsafe-eval` is only needed by dev tooling (HMR).
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com",
  "font-src 'self' data:",
  `connect-src 'self'${isProduction ? "" : " ws: wss:"}`,
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Static design mockups under /design-concepts pull CDN assets and
        // get headers without the CSP; everything else gets the full set.
        source: "/((?!design-concepts).*)",
        headers: [
          ...securityHeaders,
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
      {
        source: "/design-concepts/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/",
        has: [
          {
            type: "host",
            value: "qkiki.vercel.app",
          },
        ],
        missing: [
          {
            type: "cookie",
            key: "qkiki_session",
          },
        ],
        destination: "https://yapp.wideget.net",
        permanent: false,
        basePath: false,
      },
      {
        source: "/:path((?!api(?:/|$)|_next(?:/|$)|favicon\\.ico$|\\.well-known(?:/|$)).*)",
        has: [
          {
            type: "host",
            value: "qkiki.vercel.app",
          },
        ],
        missing: [
          {
            type: "cookie",
            key: "qkiki_session",
          },
        ],
        destination: "https://yapp.wideget.net/:path",
        permanent: false,
        basePath: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default withWorkflow(nextConfig);
