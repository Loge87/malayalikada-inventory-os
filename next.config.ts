import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server (HMR, RSC, etc.) be reached from a phone on the same
  // Wi-Fi testing against the LAN IP shown by `next dev` — without this,
  // Next silently blocks those dev-only requests and client JS never
  // hydrates, so anything driven by a React onClick (not a plain <Link>)
  // looks unresponsive on that device.
  allowedDevOrigins: ["192.168.1.80"],
  experimental: {
    serverActions: {
      // Default 1MB is too small for a bulk-upload CSV/Excel file of a few
      // thousand product rows (see /products/bulk-upload).
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
