import { expect, test } from "@playwright/test";
import { db, email, login, PASSWORD, register } from "./helpers";

/**
 * Authorisation at the HTTP level — the part unit/integration tests cannot
 * cover: proxy redirects, role dashboards, wrong passwords, stale sessions.
 */
test("anonymous visitors are sent to login; public pages stay public", async ({ page }) => {
  await page.goto("/dashboard/admin");
  await expect(page).toHaveURL(/\/auth\/login\?callbackUrl=%2Fdashboard%2Fadmin/);
  for (const path of ["/", "/campaigns", "/creators", "/brands", "/auth/register"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
});

test("a customer cannot open brand, creator or admin dashboards", async ({ page }) => {
  await register(page, "CUSTOMER", { name: "E2E Customer", email: email("customer") });
  await expect(page).toHaveURL(/\/dashboard\/customer/);
  for (const path of ["/dashboard/admin", "/dashboard/brand", "/dashboard/creator", "/dashboard/admin/users"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/dashboard\/customer/);
  }
  // Server-side too: an admin-only page must never render admin data for a customer.
  const res = await page.request.get("/dashboard/admin/users");
  expect(res.url()).toMatch(/\/dashboard\/customer/);
});

test("wrong password is refused; the account status is not revealed", async ({ page }) => {
  const userEmail = email("pw");
  await register(page, "CUSTOMER", { name: "E2E PW", email: userEmail });
  await page.context().clearCookies();
  await login(page, userEmail, "definitely-wrong");
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("a suspended account with a live session is signed out with a reason (no redirect loop)", async ({ page }) => {
  const userEmail = email("suspended");
  await register(page, "CUSTOMER", { name: "E2E Suspended", email: userEmail });
  await expect(page).toHaveURL(/\/dashboard\/customer/);
  await db().user.update({ where: { email: userEmail }, data: { status: "SUSPENDED" } });
  await page.goto("/dashboard/customer");
  await expect(page).toHaveURL(/\/auth\/login\?error=account-suspended/, { timeout: 30_000 });
  await expect(page.getByText(/suspended, so you were signed out/)).toBeVisible();
  // The cookie is gone: the dashboard now asks for a login instead of looping.
  await page.goto("/dashboard/customer");
  await expect(page).toHaveURL(/\/auth\/login\?callbackUrl=/);
});

test("logout ends the session", async ({ page }) => {
  const userEmail = email("logout");
  await register(page, "CUSTOMER", { name: "E2E Logout", email: userEmail });
  await page.getByRole("button", { name: "Log out" }).first().click();
  await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/, { timeout: 30_000 });
  await page.goto("/dashboard/customer");
  await expect(page).toHaveURL(/\/auth\/login/);
  await login(page, userEmail, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard\/customer/);
});
