import { expect, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { E2E_DATABASE_URL } from "./global-setup";

export const PASSWORD = "E2e-Password-2026";
let counter = 0;
export const uniq = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++counter}`;
export const email = (prefix: string) => `${uniq(prefix)}@e2e.refnivo.test`;

/**
 * Every actor gets its own simulated client IP (the app keys rate limits on
 * x-forwarded-for, as it does behind Vercel). Otherwise all signups in a run
 * share 127.0.0.1 and the 6th one trips the real "5 signups / 10 min" limit.
 */
let ipCounter = 0;
export function actorContext(browser: Browser) {
  ipCounter += 1;
  return browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.99.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}` } });
}
export async function actorPage(browser: Browser): Promise<Page> {
  return (await actorContext(browser)).newPage();
}

let prisma: PrismaClient | null = null;
export function db(): PrismaClient {
  prisma ??= new PrismaClient({ datasources: { db: { url: E2E_DATABASE_URL } } });
  return prisma;
}

/** Signs up through the real register form (e-mail flow, SIGNUP_APPROVAL=auto → lands on a dashboard/onboarding). */
export async function register(page: Page, role: "BRAND_OWNER" | "CREATOR" | "CUSTOMER", opts: { name: string; email: string; brandName?: string; creatorName?: string }) {
  await page.goto(`/auth/register?role=${role}`);
  await page.getByLabel("Full name").fill(opts.name);
  await page.getByLabel("Email").fill(opts.email);
  // Role-specific required fields captured at signup (brand / creator details).
  if (role === "BRAND_OWNER") {
    await page.getByLabel(/^Brand name/).fill(opts.brandName ?? `${opts.name} Brand`);
    await page.getByLabel(/^Brand category/).selectOption({ index: 1 });
  }
  if (role === "CREATOR") {
    await page.getByLabel(/^Creator name/).fill(opts.creatorName ?? opts.name);
    await page.getByLabel(/^Content category/).selectOption({ index: 1 });
  }
  // Required labels render as "Password*" (asterisk aria-hidden) — anchor instead of exact.
  await page.getByLabel(/^Password\*?$/).fill(PASSWORD);
  await page.getByLabel(/^Confirm password/).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/(dashboard|auth\/onboarding)/, { timeout: 60_000 });
}

export async function login(page: Page, userEmail: string, password = PASSWORD, opts: { expectSuccess?: boolean } = {}) {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(userEmail);
  await page.getByLabel(/^Password\*?$/).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  // The server action redirects on success; wait for it so the next goto() does not race the session cookie.
  if (opts.expectSuccess !== false) await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

export async function logout(page: Page) {
  const csrf = await page.evaluate(async () => (await fetch("/api/auth/csrf").then((r) => r.json())).csrfToken as string);
  await page.evaluate(async (token) => {
    await fetch("/api/auth/signout", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `csrfToken=${encodeURIComponent(token)}` });
  }, csrf);
}

/** Admins are never self-registrable: create one directly, the way `admin:create` does. */
export async function createAdmin() {
  const adminEmail = email("admin");
  await db().user.create({
    data: { name: "E2E Admin", email: adminEmail, passwordHash: await bcrypt.hash(PASSWORD, 10), role: "ADMIN", status: "APPROVED", approvedAt: new Date() },
  });
  return adminEmail;
}

/** Runs a ConfirmAction dialog: click the trigger, optionally fill its input, press the confirm button. */
export async function confirmAction(page: Page, trigger: string, opts: { input?: string; confirm: string }) {
  await page.getByRole("button", { name: trigger }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  if (opts.input !== undefined) await dialog.locator("#confirm-action-input").fill(opts.input);
  await dialog.getByRole("button", { name: opts.confirm, exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}
