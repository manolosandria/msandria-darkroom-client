import type { NextConfig } from "next";
import { securityHeaders } from "./security-headers";

// No remotePatterns: every <Image> uses a loader that picks a rendition already
// optimized by the API's image host, so the Next.js optimizer never fetches photos.
const nextConfig: NextConfig = {
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
