import type { NextConfig } from "next";

// No remotePatterns: every <Image> uses a loader that picks a rendition already
// optimized by the API's image host, so the Next.js optimizer never fetches photos.
const nextConfig: NextConfig = {};

export default nextConfig;
