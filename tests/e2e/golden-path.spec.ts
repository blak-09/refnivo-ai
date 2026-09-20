import { expect, test, type Browser, type Page } from "@playwright/test";
import { confirmAction, createAdmin, db, email, login, register, uniq } from "./helpers";

/**
 * The money path, end to end, through the real UI:
 *
 *   brand signs up → onboarding → product → campaign published
 *   → creator signs up → onboarding → applies → brand approves → referral link + QR
 *   → anonymous click on /r/CODE lands on the campaign page
 *   → brand records the order with the code → verifies it
 *   → creator sees the approved commission → requests payout
 *   → admin approves → marks paid with a reference
 *   → creator sees PAID
 *
 * Each actor has its own browser context (own cookies).
 */
test.describe.configure({ mode: "serial" });

const brand = { name: "E2E Brand Owner", email: email("brand"), brandName: `E2E Brand ${uniq("b")}` };
const creator = { name: "E2E Creator", email: email("creator"), username: uniq("e2ecreator").replace(/-/g, "").toLowerCase() };
let campaignSlug = "";
let referralCode = "";
let adminEmail = "";

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

test("brand: signup → onboarding → product → published campaign", async ({ browser }) => {
  const page = await newPage(browser);

  await register(page, "BRAND_OWNER", brand);
  await expect(page).toHaveURL(/\/auth\/onboarding/);
  await page.getByLabel("Brand name").fill(brand.brandName);
  await page.getByLabel("Industry / category").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Create brand & continue" }).click();
  await expect(page).toHaveURL(/\/dashboard\/brand/, { timeout: 60_000 });

  // Product (no image — uploads are covered separately).
  await page.goto("/dashboard/brand/products/new");
  await page.getByLabel("Product name").fill("E2E Headphones");
  await page.getByLabel("Category").selectOption({ index: 1 });
  await page.getByLabel("Price (₹)").fill("1999");
  await page.getByLabel("Purchase URL").fill("https://example.com/p/e2e-headphones");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  // Must leave the /products/new form (the save redirects to the list or the product page).
  await expect(page).toHaveURL(/\/dashboard\/brand\/products(?!\/new)/, { timeout: 60_000 });
  await expect(page.getByText("E2E Headphones").first()).toBeVisible();

  // Campaign wizard.
  await page.goto("/dashboard/brand/campaigns/new");
  await page.getByRole("button").filter({ hasText: "E2E Headphones" }).first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Campaign name").fill(`E2E Launch ${uniq("c")}`);
  await page.getByRole("button", { name: "Continue" }).click();
  // Fixed ₹600 commission so one verified order clears the default ₹500 payout minimum.
  await page.getByLabel("Commission type").selectOption("FIXED_AMOUNT");
  await page.getByLabel(/^Commission \(₹ per order\)/).fill("600");
  await page.getByLabel(/^Reward value \(₹\)|^Reward \(% of order\)/).fill("50");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click(); // rules & budget: defaults
  await page.getByRole("button", { name: "Continue" }).click(); // duration: defaults (starts today)
  await page.getByRole("button", { name: "Continue" }).click(); // preview
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Publish campaign" }).click();
  await expect(page).toHaveURL(/\/dashboard\/brand\/campaigns\/[a-z0-9]+$/, { timeout: 60_000 });
  await expect(page.getByText(/Active/i).first()).toBeVisible();

  const campaign = await db().campaign.findFirstOrThrow({ where: { brand: { name: brand.brandName } }, select: { slug: true, status: true } });
  expect(campaign.status).toBe("ACTIVE");
  campaignSlug = campaign.slug;
  await page.context().close();
});

test("creator: signup → onboarding → applies to the campaign", async ({ browser }) => {
  const page = await newPage(browser);
  await register(page, "CREATOR", creator);
  await expect(page).toHaveURL(/\/auth\/onboarding/);
  await page.getByLabel("Display name").fill(creator.name);
  await page.getByLabel("Username").fill(creator.username);
  await page.getByLabel("Creator category").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Create profile & continue" }).click();
  await expect(page).toHaveURL(/\/dashboard\/creator/, { timeout: 60_000 });

  // The campaign was published with the default "creators need approval" rule.
  await page.goto(`/campaigns/${campaignSlug}`);
  await page.getByRole("button", { name: "Apply to this campaign" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByText(/Application sent/).first()).toBeVisible({ timeout: 30_000 });

  const app = await db().partnerApplication.findFirstOrThrow({ where: { user: { email: creator.email } } });
  expect(app.status).toBe("PENDING");
  await page.context().close();
});

test("brand: approves the application; creator receives referral link and QR", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, brand.email);
  await expect(page).toHaveURL(/\/dashboard\/brand/, { timeout: 60_000 });
  await page.goto("/dashboard/brand/creators");
  await expect(page.getByText(creator.name).first()).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0, { timeout: 30_000 });
  await page.context().close();

  const link = await db().referralLink.findFirstOrThrow({ where: { owner: { email: creator.email } } });
  expect(link.status).toBe("ACTIVE");
  referralCode = link.code;

  const creatorPage = await newPage(browser);
  await login(creatorPage, creator.email);
  await creatorPage.goto("/dashboard/creator/links");
  await expect(creatorPage.getByText(referralCode).first()).toBeVisible({ timeout: 30_000 });
  await expect(creatorPage.getByRole("img", { name: /QR code/i }).first()).toBeVisible();
  await creatorPage.context().close();
});

test("anonymous visitor: /r/CODE redirects to the campaign with the referrer shown", async ({ browser }) => {
  const page = await newPage(browser);
  const res = await page.goto(`/r/${referralCode}`);
  expect(res?.status()).toBe(200); // after the 302
  await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignSlug}\\?ref=${referralCode}`));
  await expect(page.getByText(`Recommended by ${creator.name}`)).toBeVisible();
  await expect(page.getByText(referralCode).first()).toBeVisible();
  await page.context().close();
});

test("brand: records the order with the code and verifies it", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, brand.email);
  await expect(page).toHaveURL(/\/dashboard\/brand/, { timeout: 60_000 });
  await page.goto("/dashboard/brand/orders");
  await page.getByLabel("Referral code").fill(referralCode);
  await page.getByLabel("Order reference").fill(`E2E-ORD-${uniq("o")}`);
  await page.getByLabel("Order value (₹)").fill("1999");
  await page.getByRole("button", { name: "Record order" }).click();
  await expect(page.getByText("Pending verification").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Verify" }).first().click();
  await expect(page.getByText("Verified", { exact: true }).first()).toBeVisible({ timeout: 30_000 });

  const commission = await db().commission.findFirstOrThrow({ where: { creator: { email: creator.email } } });
  expect(commission.status).toBe("APPROVED");
  expect(commission.amount).toBe(60_000); // ₹600 in paise
  await page.context().close();
});

test("creator: sees the approved commission and requests a payout", async ({ browser }) => {
  const page = await newPage(browser);
  await login(page, creator.email);
  await expect(page).toHaveURL(/\/dashboard\/creator/, { timeout: 60_000 });
  await page.goto("/dashboard/creator/earnings");
  await expect(page.getByText("₹600").first()).toBeVisible();
  await page.getByRole("button", { name: "Request payout" }).click();
  await expect(page.getByText(/A request for ₹600 is requested/).first()).toBeVisible({ timeout: 30_000 });
  await page.context().close();
});

test("admin: approves and marks the payout paid; creator sees PAID", async ({ browser }) => {
  adminEmail = await createAdmin();
  const page = await newPage(browser);
  await login(page, adminEmail);
  await expect(page).toHaveURL(/\/dashboard\/admin/, { timeout: 60_000 });
  await page.goto("/dashboard/admin/payouts");
  await expect(page.getByText(creator.email)).toBeVisible();
  await confirmAction(page, "Approve", { input: "looks good", confirm: "Approve" });
  await confirmAction(page, "Mark paid", { input: "UPI-E2E-0001", confirm: "Mark as paid" });
  await expect(page.getByText("UPI-E2E-0001")).toBeVisible();

  const commission = await db().commission.findFirstOrThrow({ where: { creator: { email: creator.email } } });
  expect(commission.status).toBe("PAID");
  await page.context().close();

  const creatorPage = await newPage(browser);
  await login(creatorPage, creator.email);
  await creatorPage.goto("/dashboard/creator/earnings");
  await expect(creatorPage.getByText("UPI-E2E-0001")).toBeVisible(); // settlement reference in the payout history
  await creatorPage.context().close();
});
