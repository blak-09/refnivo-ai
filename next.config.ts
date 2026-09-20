import type { NextConfig } from "next";
import { NOINDEX_HEADER, securityHeaders } from "./lib/config/security-headers";
import { storagePublicOrigin } from "./lib/storage/hosted-image";

// Only images WE host go through the optimizer (see lib/storage/hosted-image.ts):
// local /uploads always, plus the configured storage bucket's origin.
const storageOrigin = storagePublicOrigin();
const remotePatterns = storageOrigin ? [{ protocol: "https" as const, hostname: new URL(storageOrigin).hostname }] : [];

const nextConfig: NextConfig = {
  // Keep Turbopack scoped to this project (a package-lock.json exists in the user home dir).
  turbopack: { root: __dirname },
  // Allow the dev server to be reached through a Cloudflare quick tunnel (see README "Share a temporary link").
  allowedDevOrigins: ["*.trycloudflare.com"],
  // Never leak the framework version.
  poweredByHeader: false,
  images: { remotePatterns, formats: ["image/avif", "image/webp"] },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders() },
      { source: "/(dashboard|auth|admin|api)", headers: [NOINDEX_HEADER] },
      { source: "/(dashboard|auth|admin|api)/(.*)", headers: [NOINDEX_HEADER] },
    ];
  },
};

export default nextConfig;
