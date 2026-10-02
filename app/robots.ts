import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/services/links";

/** Public marketing pages are crawlable; private and transactional routes are not. */
export default function robots(): MetadataRoute.Robots {
  const origin = appOrigin();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/", "/auth/", "/r/", "/registration-pending"] }],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
