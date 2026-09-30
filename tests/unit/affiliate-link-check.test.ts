import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyStatus, isPublicHttpUrl } from "@/lib/services/affiliate-link-check";
import { EXAMPLE_AFFILIATE_PROGRAMS } from "../../prisma/seed-data/affiliate-programs";

describe("official programme link check", () => {
  it("treats pages that answer as reachable and missing/failing pages as broken", () => {
    expect(classifyStatus(200)).toEqual({ reachable: true, status: "ok 200" });
    expect(classifyStatus(301)).toEqual({ reachable: true, status: "ok 301" });
    // Bot-blocking sites still prove the page exists.
    for (const code of [401, 403, 429, 432]) expect(classifyStatus(code).reachable).toBe(true);
    for (const code of [404, 410, 500, 503]) expect(classifyStatus(code)).toEqual({ reachable: false, status: `broken ${code}` });
  });

  it("only ever fetches public http(s) hosts", () => {
    expect(isPublicHttpUrl("https://www.anker.com/become-an-affiliate")).toBe(true);
    for (const url of ["http://localhost:3000/x", "http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1/", "http://169.254.169.254/latest", "ftp://example.com", "javascript:alert(1)", "https://intranet"]) {
      expect(isPublicHttpUrl(url), url).toBe(false);
    }
  });
});

describe("seeded programme logos", () => {
  it("ships a logo file for every seeded programme", () => {
    for (const e of EXAMPLE_AFFILIATE_PROGRAMS) {
      expect(existsSync(path.join(process.cwd(), "public", e.logoUrl!)), e.logoUrl!).toBe(true);
    }
  });
});
