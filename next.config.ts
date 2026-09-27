import type { NextConfig } from "next";
import withBundleAnalyzerFactory from "@next/bundle-analyzer";

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

// Off by default — `ANALYZE=true npm run build` opens the actual per-route
// client bundle treemap in a browser tab after the build finishes. Next 16's
// Turbopack build no longer prints the old per-route Size/First Load JS
// table in the terminal, so this is the only way to get real numbers now.
const withBundleAnalyzer = withBundleAnalyzerFactory({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(nextConfig);
