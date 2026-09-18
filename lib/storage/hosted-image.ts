/**
 * Which image URLs the Next.js image optimizer may process.
 *
 * Product, brand and creator images can be arbitrary external URLs (pasted by
 * users), and running the optimizer against any host would turn it into an
 * open image proxy. So only images WE host are optimized (resized, WebP/AVIF,
 * lazy): local uploads under /uploads and the configured storage origin.
 * Everything else renders as a plain <img>. Pure; unit-tested.
 */
export function storagePublicOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.NEXT_PUBLIC_STORAGE_PUBLIC_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function isHostedImage(src: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!src) return false;
  if (src.startsWith("/uploads/")) return true;
  const origin = storagePublicOrigin(env);
  if (!origin) return false;
  try {
    return new URL(src).origin === origin;
  } catch {
    return false;
  }
}
