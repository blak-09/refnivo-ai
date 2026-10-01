"use client";

/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import Image from "next/image";
import { isHostedImage } from "@/lib/storage/hosted-image";

/**
 * The image inside ProductThumb / BrandLogo. If the file fails to load (a moved
 * logo, a dead external URL) it renders `fallback` — initials or an icon —
 * so a card never shows a broken-image glyph.
 */
export function Picture({
  src,
  alt,
  priority,
  sizes,
  fit,
  fallback,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  fit: "cover" | "contain";
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return <>{fallback}</>;
  const cls = fit === "cover" ? "size-full object-cover" : "size-full object-contain";
  const onError = () => setFailed(true);
  if (isHostedImage(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? "(max-width: 640px) 100vw, 320px"}
        className={cls}
        priority={priority}
        unoptimized={src.startsWith("data:")}
        onError={onError}
      />
    );
  }
  return <img src={src} alt={alt} className={cls} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "auto"} onError={onError} />;
}
