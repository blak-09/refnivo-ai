import { isHostedImage } from "./hosted-image";

/**
 * When an image field changes, the previous object is deleted from OUR storage
 * (never from an external host). Best effort and outside the transaction: a
 * failed delete only leaves an orphan file behind, never a broken record.
 */
export function cleanupReplacedImages(pairs: { previous: string | null | undefined; next: string | null | undefined }[]): void {
  const stale = pairs.filter((p) => p.previous && p.previous !== p.next && isHostedImage(p.previous)).map((p) => p.previous as string);
  if (!stale.length) return;
  void (async () => {
    try {
      // Lazy: the storage factory is server-only and must not be pulled into service modules at import time.
      const { getStorage } = await import("./index");
      const storage = await getStorage();
      await Promise.all(stale.map((key) => storage.remove(key)));
    } catch (err) {
      console.error("[storage] cleanup failed", err instanceof Error ? err.message : err);
    }
  })();
}
