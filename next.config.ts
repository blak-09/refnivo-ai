import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack scoped to this project (a package-lock.json exists in the user home dir).
  turbopack: { root: __dirname },
  // Allow the dev server to be reached through a Cloudflare quick tunnel (see README "Share a temporary link").
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
