import "server-only";

/**
 * Storage abstraction. The MVP ships a local-disk driver (writes to
 * `public/uploads`), but the interface is deliberately provider-agnostic so a
 * cloud driver (Cloudflare R2, AWS S3, Cloudinary, Supabase Storage) can be
 * dropped in later by implementing `StorageDriver` and switching `getStorage()`
 * on an env var — no calling code changes.
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
    // Future: case "r2" / "s3" / "cloudinary" / "supabase" → return that driver.
    case "local":
    default: {
      const { LocalStorageDriver } = await import("./local");
      cached = new LocalStorageDriver();
      return cached;
    }
  }
}
