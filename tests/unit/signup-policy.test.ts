import { describe, expect, it } from "vitest";
import { isAutoApproved, manualReviewRoles, parseSignupPolicy, REGISTRABLE } from "@/lib/config/signup-policy";
import { validateProductionEnv } from "@/lib/config/env";

describe("parseSignupPolicy", () => {
  it("defaults to auto (every registrable role) when unset or blank", () => {
    for (const raw of [undefined, "", "  ", "auto", "AUTO"]) {
      const { policy, error } = parseSignupPolicy(raw);
      expect(error).toBeNull();
      expect([...policy.autoApprove].sort()).toEqual([...REGISTRABLE].sort());
    }
  });

  it("manual approves nobody", () => {
    const { policy, error } = parseSignupPolicy("manual");
    expect(error).toBeNull();
    expect(policy.autoApprove.size).toBe(0);
  });

  it("accepts a comma list of registrable roles (case/whitespace tolerant)", () => {
    const { policy, error } = parseSignupPolicy(" creator , CUSTOMER ");
    expect(error).toBeNull();
    expect(policy.autoApprove.has("CREATOR")).toBe(true);
    expect(policy.autoApprove.has("CUSTOMER")).toBe(true);
    expect(policy.autoApprove.has("BRAND_OWNER")).toBe(false);
  });

  it("rejects unknown roles — including ADMIN — and reports them by name", () => {
    const { error } = parseSignupPolicy("CREATOR,ADMIN,foo");
    expect(error).toContain("ADMIN");
    expect(error).toContain("FOO");
  });
});

const env = (SIGNUP_APPROVAL: string) => ({ NODE_ENV: "test", SIGNUP_APPROVAL }) as NodeJS.ProcessEnv;

describe("isAutoApproved / manualReviewRoles", () => {
  it("ADMIN is never auto-approved, even under auto", () => {
    expect(isAutoApproved("ADMIN", env("auto"))).toBe(false);
    expect(isAutoApproved("CREATOR", env("auto"))).toBe(true);
  });

  it("lists the roles that still wait for an admin", () => {
    expect(manualReviewRoles(env("auto"))).toEqual([]);
    expect(manualReviewRoles(env("manual"))).toEqual(["BRAND_OWNER", "CREATOR", "CUSTOMER"]);
    expect(manualReviewRoles(env("CREATOR,CUSTOMER"))).toEqual(["BRAND_OWNER"]);
  });
});

describe("validateProductionEnv — SIGNUP_APPROVAL", () => {
  const base = {
    NODE_ENV: "production",
    AUTH_SECRET: "x".repeat(40),
    DATABASE_URL: "postgresql://u:p@db.example.net:6543/app?pgbouncer=true",
    NEXT_PUBLIC_APP_URL: "https://app.example.com",
    NEXTAUTH_URL: "https://app.example.com",
  } as NodeJS.ProcessEnv;

  it("accepts auto/manual/role lists and rejects garbage", () => {
    expect(validateProductionEnv({ ...base, SIGNUP_APPROVAL: "auto" }).errors).toEqual([]);
    expect(validateProductionEnv({ ...base, SIGNUP_APPROVAL: "manual" }).errors).toEqual([]);
    expect(validateProductionEnv({ ...base, SIGNUP_APPROVAL: "BRAND_OWNER" }).errors).toEqual([]);
    expect(validateProductionEnv({ ...base, SIGNUP_APPROVAL: "everyone" }).errors.join(" ")).toContain("SIGNUP_APPROVAL");
  });
});
