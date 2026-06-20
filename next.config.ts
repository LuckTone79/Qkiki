import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
import {
  LEGACY_SESSION_COOKIES,
  SESSION_COOKIE,
} from "./src/lib/auth-constants";
import { APP_CANONICAL_URL } from "./src/lib/brand";

const vercelAliasPattern = "(?:qkiki|yapp)\\.vercel\\.app";
const missingSessionCookies = [SESSION_COOKIE, ...LEGACY_SESSION_COOKIES].map((key) => ({
  type: "cookie" as const,
  key,
}));

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        has: [
          {
            type: "host",
            value: vercelAliasPattern,
          },
        ],
        missing: missingSessionCookies,
        destination: APP_CANONICAL_URL,
        permanent: false,
        basePath: false,
      },
      {
        source: "/:path((?!api(?:/|$)|_next(?:/|$)|favicon\\.ico$|\\.well-known(?:/|$)).*)",
        has: [
          {
            type: "host",
            value: vercelAliasPattern,
          },
        ],
        missing: missingSessionCookies,
        destination: `${APP_CANONICAL_URL}/:path`,
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
