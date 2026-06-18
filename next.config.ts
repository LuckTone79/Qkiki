import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
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
