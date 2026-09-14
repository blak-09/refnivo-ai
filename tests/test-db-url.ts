/** Dedicated database for integration tests — created by `npm run db:local`. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/localgrowth_test?schema=public";
