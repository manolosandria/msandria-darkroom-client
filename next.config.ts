import type { NextConfig } from "next";
import { securityHeaders } from "./security-headers";

// Public photos use native srcset; admin previews use unoptimized <Image>.
// Both consume the API's ready-made URLs, without the Next.js image optimizer.
const nextConfig: NextConfig = {
  experimental: {
    // Avoid the local socket handshake used by child-process PostCSS workers.
    turbopackPluginRuntimeStrategy: "workerThreads",
  },
  // Read at build time, like every NEXT_PUBLIC_ variable: the policy that ships is the
  // one built with the API URL this build was made for.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(
          process.env.NEXT_PUBLIC_API_URL,
          process.env.NODE_ENV === "development",
        ),
      },
    ];
  },
};

export default nextConfig;
