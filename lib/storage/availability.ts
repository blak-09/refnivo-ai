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

/** Operator-facing, secret-free description of the storage configuration (shown on /api/health). */
export function describeStorage(env: NodeJS.ProcessEnv = process.env): { provider: string; available: boolean; host?: string; bucket?: string; publicBase?: string } {
  const provider = (env.STORAGE_PROVIDER ?? "local").trim().toLowerCase();
  const out: { provider: string; available: boolean; host?: string; bucket?: string; publicBase?: string } = { provider, available: uploadsAvailable(env) };
  if (provider === "supabase") {
    try {
      out.host = env.SUPABASE_URL ? new URL(env.SUPABASE_URL.trim()).host : undefined;
    } catch {
      out.host = "(invalid SUPABASE_URL)";
    }
    out.bucket = env.SUPABASE_STORAGE_BUCKET?.trim() || "uploads";
    out.publicBase = env.NEXT_PUBLIC_STORAGE_PUBLIC_URL?.trim() || undefined;
  }
  return out;
}
