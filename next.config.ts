import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
import {
  LEGACY_SESSION_COOKIES,
  SESSION_COOKIE,
} from "./src/lib/auth-constants";
import { APP_CANONICAL_URL } from "./src/lib/brand";
import { getSupabaseAuthCookieName } from "./src/lib/supabase/env";

const vercelAliasPattern = "(?:qkiki|yapp)\\.vercel\\.app";
// Real users now carry a Supabase auth cookie instead of SESSION_COOKIE.
// Without this, a signed-in Supabase user landing on a preview alias would
// look "logged out" to this check and get bounced to the canonical domain.
const supabaseAuthCookieName = getSupabaseAuthCookieName();
const missingSessionCookies = [
  SESSION_COOKIE,
  ...LEGACY_SESSION_COOKIES,
  ...(supabaseAuthCookieName ? [supabaseAuthCookieName] : []),
].map((key) => ({
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
