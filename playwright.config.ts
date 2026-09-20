import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke tests. They drive the real app (Next dev server) against a
 * dedicated local database (`localgrowth_e2e`, created by tests/e2e/global-setup.ts),
 * so they never touch development or production data.
 *
 *   npm run test:e2e            # starts the server itself (needs Postgres on :5433 → `npm run db:local`)
 *   E2E_BASE_URL=http://localhost:3000 npm run test:e2e   # reuse a server you already run
 *
 * CI runs them on every push with a postgres service (see .github/workflows/ci.yml).
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const port = Number(new URL(baseURL).port || 3100);

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next dev --port ${port}`,
        // Readiness only: this page renders without the database (globalSetup creates the e2e DB after the server starts).
        url: `${baseURL}/auth/login`,
        reuseExistingServer: false,
        timeout: 240_000,
        env: {
          ...(process.env as Record<string, string>),
          PORT: String(port),
          DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/localgrowth_e2e?schema=public",
          AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-secret-e2e-secret-e2e-secret-e2e-secret",
          NEXTAUTH_URL: baseURL,
          NEXT_PUBLIC_APP_URL: baseURL,
          SIGNUP_APPROVAL: "auto",
          EMAIL_PROVIDER: "console",
          STORAGE_PROVIDER: "local",
          RATE_LIMIT_PROVIDER: "memory",
          NEXT_PUBLIC_SHOW_DEMO_LOGINS: "false",
          GOOGLE_CLIENT_ID: "",
          GOOGLE_CLIENT_SECRET: "",
          NEXT_TELEMETRY_DISABLED: "1",
        },
      },
});
