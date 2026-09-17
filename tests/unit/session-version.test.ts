import { describe, expect, it } from "vitest";
import { isSessionCurrent, LEGACY_SESSION_VERSION, rotationRedirect, sessionCookieOptions, tokenSessionVersion } from "@/lib/auth/session-version";

describe("session version — backward-compatible JWT handling", () => {
  it("treats tokens issued before versioning (no `sv`) as version 1", () => {
    expect(tokenSessionVersion(undefined)).toBe(LEGACY_SESSION_VERSION);
    expect(tokenSessionVersion(null)).toBe(1);
    expect(tokenSessionVersion("2")).toBe(1); // wrong type → legacy, never trusted
    expect(tokenSessionVersion(0)).toBe(1);
    expect(tokenSessionVersion(-3)).toBe(1);
    expect(tokenSessionVersion(2.5)).toBe(1);
  });

  it("old tokens stay valid for users who never changed their password (DB version 1)", () => {
    expect(isSessionCurrent(undefined, 1)).toBe(true);
    expect(isSessionCurrent(1, 1)).toBe(true);
  });

  it("rejects stale tokens after the DB version moved on", () => {
    expect(isSessionCurrent(undefined, 2)).toBe(false);
    expect(isSessionCurrent(1, 2)).toBe(false);
    expect(isSessionCurrent(2, 3)).toBe(false);
    expect(isSessionCurrent(3, 2)).toBe(false); // a token can never be "ahead" of the DB
  });

  it("accepts the current version", () => {
    expect(isSessionCurrent(2, 2)).toBe(true);
    expect(isSessionCurrent(7, 7)).toBe(true);
  });
});

describe("forced password rotation redirect", () => {
  const home = "/dashboard/admin";

  it("does nothing when rotation is not required", () => {
    expect(rotationRedirect({ mustChangePassword: false, pathname: "/dashboard/admin", roleHome: home })).toBeNull();
  });

  it("redirects dashboard pages to the settings page", () => {
    expect(rotationRedirect({ mustChangePassword: true, pathname: "/dashboard/admin", roleHome: home })).toBe("/dashboard/admin/settings?rotate=1");
    expect(rotationRedirect({ mustChangePassword: true, pathname: "/dashboard/admin/registrations", roleHome: home })).toBe("/dashboard/admin/settings?rotate=1");
    expect(rotationRedirect({ mustChangePassword: true, pathname: "/dashboard", roleHome: home })).toBe("/dashboard/admin/settings?rotate=1");
  });

  it("allows the settings page itself and non-dashboard routes so the rotation can happen", () => {
    expect(rotationRedirect({ mustChangePassword: true, pathname: "/dashboard/admin/settings", roleHome: home })).toBeNull();
    expect(rotationRedirect({ mustChangePassword: true, pathname: "/dashboard/admin/settings/", roleHome: home })).toBeNull();
    expect(rotationRedirect({ mustChangePassword: true, pathname: "/auth/login", roleHome: home })).toBeNull();
    expect(rotationRedirect({ mustChangePassword: true, pathname: "/", roleHome: home })).toBeNull();
  });
});

describe("session cookie options", () => {
  it("uses Secure + __Secure- prefix under https, plain name under http", () => {
    const prod = sessionCookieOptions("https://app.example.com");
    expect(prod.name).toBe("__Secure-authjs.session-token");
    expect(prod.options).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });

    const dev = sessionCookieOptions("http://localhost:3000");
    expect(dev.name).toBe("authjs.session-token");
    expect(dev.options.secure).toBe(false);
    expect(dev.options.httpOnly).toBe(true);
  });

  it("falls back to the non-secure name when the URL is missing or invalid", () => {
    expect(sessionCookieOptions(undefined).options.secure).toBe(false);
    expect(sessionCookieOptions("not a url").options.secure).toBe(false);
  });
});
