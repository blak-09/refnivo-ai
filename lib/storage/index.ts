import "server-only";

/**
 * Storage abstraction. Two drivers:
 *   local     — writes to `public/uploads` (development / self-hosted with a disk)
 *   supabase  — Supabase Storage public bucket over its REST API (production)
 * The interface is provider-agnostic so R2/S3/Cloudinary can be added the same
 * way — `StorageDriver` + a case in `getStorage()`, no calling code changes.
 *
 * Validation rules live in `image-validation.ts` (pure, unit-tested).
 */

export { uploadsAvailable } from "./availability";
export {
  ALLOWED_IMAGE_TYPES,
  IMAGE_EXT_BY_TYPE,
  MAX_IMAGE_BYTES,
  imageValidationMessage,
  makeObjectName,
  sanitizePrefix,
  validateImage,
  validateImageBytes,
  type AllowedImageType,
  type ByteValidation,
  type ImageValidationError,
} from "./image-validation";

export type StoredFile = {
  /** Public URL/path used in <img src> and stored in the DB. */
  url: string;
  /** Provider key/path — useful for deletion. */
  key: string;
};

export interface StorageDriver {
  /** Persist bytes and return the public URL + key. */
  put(input: { data: Buffer; contentType: string; ext: string; prefix?: string }): Promise<StoredFile>;
  /** Best-effort deletion of a previously stored file. Never throws on missing. */
  remove(key: string): Promise<void>;
}

let cached: StorageDriver | null = null;

export async function getStorage(): Promise<StorageDriver> {
  if (cached) return cached;
  const provider = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  switch (provider) {
    case "supabase": {
      const { supabaseStorageConfig, SupabaseStorageDriver } = await import("./supabase");
      const cfg = supabaseStorageConfig();
      if (!cfg) throw new Error("STORAGE_PROVIDER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
      cached = new SupabaseStorageDriver(cfg);
      return cached;
    }
    // Future: case "r2" / "s3" / "cloudinary" → return that driver.
    case "local":
    default: {
      const { LocalStorageDriver } = await import("./local");
      cached = new LocalStorageDriver();
      return cached;
    }
  }
}
