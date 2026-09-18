/**
 * Whether uploads can actually be persisted here. The local driver writes to
 * the project's `public/uploads`, which is read-only on serverless hosts
 * (Vercel) and wiped on every redeploy elsewhere — so in production it is only
 * honoured when the operator explicitly accepts that with STORAGE_ALLOW_LOCAL=1
 * (self-hosted node with a persistent disk). Pure: unit-tested.
 */
export function uploadsAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  const provider = (env.STORAGE_PROVIDER ?? "local").trim().toLowerCase();
  if (provider === "supabase") return !!env.SUPABASE_URL?.trim() && !!env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (provider !== "local") return false;
  if (env.NODE_ENV !== "production") return true;
  return env.STORAGE_ALLOW_LOCAL === "1";
}
