import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { makeObjectName, sanitizePrefix } from "./image-validation";
import type { StorageDriver, StoredFile } from "./index";

/**
 * Development / self-hosted driver. Files land in `public/uploads/<prefix>/…`
 * and are served by Next as static assets at `/uploads/<prefix>/…`.
 * Swap `getStorage()` to a cloud driver for production at scale.
 */
export class LocalStorageDriver implements StorageDriver {
  private readonly publicDir = path.join(process.cwd(), "public");
  private readonly baseDir = path.join(process.cwd(), "public", "uploads");

  async put(input: { data: Buffer; contentType: string; ext: string; prefix?: string }): Promise<StoredFile> {
    const prefix = sanitizePrefix(input.prefix);
    const dir = path.join(this.baseDir, prefix);
    await mkdir(dir, { recursive: true });
    const name = makeObjectName(input.data, input.ext);
    await writeFile(path.join(dir, name), input.data);
    const url = `/uploads/${prefix}/${name}`.replace(/\/+/g, "/");
    return { url, key: url };
  }

  async remove(key: string): Promise<void> {
    // Only ever touch files inside public/uploads.
    if (!key.startsWith("/uploads/")) return;
    const abs = path.join(this.publicDir, key);
    if (!abs.startsWith(this.baseDir)) return;
    try {
      await unlink(abs);
    } catch {
      /* already gone — best effort */
    }
  }
}
