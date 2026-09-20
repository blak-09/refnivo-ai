import { describe, expect, it } from "vitest";
import { canonicalRedirect } from "@/lib/config/canonical-host";

const env = (v: Record<string, string>) => v as NodeJS.ProcessEnv;
const req = (host: string, pathname = "/dashboard/brand", search = "?x=1") => ({ host, protocol: "https:", pathname, search });

describe("canonical host redirect (custom domain)", () => {
  const prod = env({ VERCEL_ENV: "production", NEXT_PUBLIC_APP_URL: "https://www.refnivo.com" });
  it("sends the platform alias to the canonical domain, keeping path and query", () => {
    expect(canonicalRedirect(req("refnivo-ai.vercel.app"), prod)).toBe("https://www.refnivo.com/dashboard/brand?x=1");
  });
  it("leaves the canonical host, other mapped domains, previews and local dev alone", () => {
    expect(canonicalRedirect(req("www.refnivo.com"), prod)).toBeNull();
    expect(canonicalRedirect(req("WWW.REFNIVO.COM"), prod)).toBeNull();
    expect(canonicalRedirect(req("refnivo.com"), prod)).toBeNull(); // Vercel already 308s the apex; never loop on it here
    expect(canonicalRedirect(req("refnivo-ai-git-feature.vercel.app"), env({ VERCEL_ENV: "preview", NEXT_PUBLIC_APP_URL: "https://www.refnivo.com" }))).toBeNull();
    expect(canonicalRedirect(req("localhost:3000"), env({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }))).toBeNull();
    expect(canonicalRedirect(req("refnivo-ai.vercel.app"), env({ VERCEL_ENV: "production" }))).toBeNull(); // no canonical configured
  });
});
