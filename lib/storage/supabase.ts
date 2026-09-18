import "server-only";
import { makeObjectName, sanitizePrefix } from "./image-validation";
import type { StorageDriver, StoredFile } from "./index";

/**
 * Supabase Storage driver (plain REST, no SDK). Uses the project that already
 * hosts the database, so no new vendor is introduced.
 *
 *   STORAGE_PROVIDER=supabase
 *   SUPABASE_URL=https://<ref>.supabase.co          (Project settings → API)
 *   SUPABASE_SERVICE_ROLE_KEY=…                     (server only — never NEXT_PUBLIC_)
 *   SUPABASE_STORAGE_BUCKET=uploads                 (a PUBLIC bucket; default "uploads")
 *   NEXT_PUBLIC_STORAGE_PUBLIC_URL=https://<ref>.supabase.co/storage/v1/object/public/uploads
 *
 * Objects are written under <prefix>/<content-hash>.<ext>; the returned URL is
 * the bucket's public URL (served by Supabase's CDN). The service key never
 * leaves the server: uploads always go through our authenticated route.
 */
export type SupabaseStorageConfig = { url: string; serviceKey: string; bucket: string; publicBase: string };

export function supabaseStorageConfig(env: NodeJS.ProcessEnv = process.env): SupabaseStorageConfig | null {
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  const bucket = env.SUPABASE_STORAGE_BUCKET?.trim() || "uploads";
  const publicBase = (env.NEXT_PUBLIC_STORAGE_PUBLIC_URL?.trim() || `${url}/storage/v1/object/public/${bucket}`).replace(/\/$/, "");
  return { url, serviceKey, bucket, publicBase };
}

export class SupabaseStorageDriver implements StorageDriver {
  constructor(
    private readonly cfg: SupabaseStorageConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.cfg.serviceKey}`, apikey: this.cfg.serviceKey, ...extra };
  }

  async put(input: { data: Buffer; contentType: string; ext: string; prefix?: string }): Promise<StoredFile> {
    const prefix = sanitizePrefix(input.prefix);
    const key = `${prefix ? `${prefix}/` : ""}${makeObjectName(input.data, input.ext)}`;
    const res = await this.fetchImpl(`${this.cfg.url}/storage/v1/object/${this.cfg.bucket}/${key}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": input.contentType, "x-upsert": "true", "cache-control": "public, max-age=31536000, immutable" }),
      body: new Uint8Array(input.data),
    });
    if (!res.ok) {
      // Never include the key/token; the status + Supabase's short message is enough to diagnose.
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(`Supabase Storage upload failed (${res.status}): ${detail || res.statusText}`);
    }
    return { url: `${this.cfg.publicBase}/${key}`, key };
  }

  async remove(key: string): Promise<void> {
    const objectKey = key.startsWith(this.cfg.publicBase) ? key.slice(this.cfg.publicBase.length + 1) : key;
    if (!objectKey || objectKey.includes("..")) return;
    try {
      await this.fetchImpl(`${this.cfg.url}/storage/v1/object/${this.cfg.bucket}/${objectKey}`, { method: "DELETE", headers: this.headers() });
    } catch {
      /* best effort */
    }
  }
}
