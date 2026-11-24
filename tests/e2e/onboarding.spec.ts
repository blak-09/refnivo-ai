import { expect, test } from "@playwright/test";
import { actorContext, completeProfile, db, email, register, uniq } from "./helpers";

// Each test is its own client: separate cookies and a separate simulated IP.
test.use({ context: async ({ browser }, provide) => provide(await actorContext(browser)) });

const TINY_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test("role can change mid-signup; progress survives a reload; the profile can be edited later", async ({ page }) => {
  test.setTimeout(240_000); // the whole journey, end to end
  const actor = { name: "E2E Switcher", email: email("switch"), username: uniq("sw").replace(/-/g, "_").toLowerCase().slice(0, 28) };
  await register(page, "CUSTOMER", actor, { profile: false });
  await expect(page.getByRole("heading", { name: "Create Your Customer Profile" })).toBeVisible();

  // Back to page 1: the current role is pre-selected; switch to Creator.
  await page.goto("/get-started");
  await expect(page.getByRole("radio", { name: /I'm a Customer/ })).toHaveAttribute("aria-checked", "true");
  await page.locator("a, button", { hasText: "Continue as Creator" }).first().click();
  await expect(page.getByRole("heading", { name: "Create Your Creator Profile" })).toBeVisible({ timeout: 60_000 });
  expect((await db().user.findUniqueOrThrow({ where: { email: actor.email } })).role).toBe("CREATOR");
  await expect.poll(async () => (await db().auditLog.count({ where: { action: "ONBOARDING_ROLE_CHANGED", user: { email: actor.email } } }))).toBe(1);

  // The session was refreshed: proxy routing follows the new role (no redirect loop).
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/onboarding\/profile/, { timeout: 30_000 });

  // Save progress → reload → still there; nothing public written yet.
  await page.getByLabel(/^Username/).fill(actor.username);
  await page.getByLabel(/^City/).fill("Jaipur");
  await page.getByRole("checkbox", { name: "Product reviews" }).check({ force: true });
  await page.getByRole("button", { name: /Save/ }).first().click();
  await expect(page.getByText(/Progress saved at/)).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByLabel(/^City/)).toHaveValue("Jaipur");
  await expect(page.getByRole("checkbox", { name: "Product reviews" })).toBeChecked();
  expect(await db().creatorProfile.count({ where: { user: { email: actor.email } } })).toBe(0);

  // Required fields are enforced on the server: Continue without them stays on the page with errors.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Professional bio is required").or(page.getByText(/Professional bio must be/))).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/onboarding\/profile/);

  await completeProfile(page, "CREATOR", actor);
  const profile = await db().creatorProfile.findFirstOrThrow({ where: { user: { email: actor.email } } });
  expect(profile).toMatchObject({ username: actor.username, city: "Jaipur", collaborationPreferences: ["PRODUCT_REVIEW"] });

  // Once complete, the role page sends you to your dashboard.
  await page.goto("/get-started");
  await expect(page).toHaveURL(/\/dashboard\/creator/, { timeout: 30_000 });

  // Settings → Edit profile → visible on the public page.
  await page.goto("/dashboard/creator/settings");
  await page.locator("a", { hasText: "Edit profile" }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/creator\/profile/);
  await page.getByLabel(/^Professional bio/).fill("Edited bio from the e2e suite — long enough to count.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile saved.").first()).toBeVisible({ timeout: 30_000 });
  await page.goto(`/creators/${actor.username}`);
  await expect(page.getByText("Edited bio from the e2e suite").first()).toBeVisible();
});

test("brand logo uploads before the brand exists, and the preview shows it", async ({ page }) => {
  const actor = { name: "E2E Logo", email: email("logo"), brandName: `Logo Brand ${uniq("l")}` };
  await register(page, "BRAND_OWNER", actor, { profile: false });
  await page.getByLabel("Upload logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(page.getByText("Image uploaded.").first()).toBeVisible({ timeout: 30_000 });
  await completeProfile(page, "BRAND_OWNER", actor);
  const brand = await db().brand.findFirstOrThrow({ where: { owner: { email: actor.email } } });
  expect(brand.logoUrl).toMatch(/\/brands\/logo\/u-/);
});

test("register links without a role start at the role page", async ({ page }) => {
  const res = await page.request.get("/auth/register?callbackUrl=%2Fcampaigns", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toContain("/get-started?next=%2Fcampaigns");
});
