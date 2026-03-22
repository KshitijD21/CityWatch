import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
    if (!insforgeUrl) return [];
    return [
      {
        // Proxy InsForge auth requests through our origin so httpOnly cookies
        // are set as first-party (Chrome blocks third-party cookies on reload).
        source: "/api/auth/:path*",
        destination: `${insforgeUrl}/api/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
