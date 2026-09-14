import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/test-db-url";

/**
 * Integration tests run against a separate database so they can reset it
 * freely. `npm run db:local` creates `localgrowth_test` alongside `localgrowth`.
 */

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_SECRET: "test-secret",
      NEXTAUTH_URL: "http://localhost:3000",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      AI_PROVIDER: "mock",
    },
    // DB tests share one database — run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
