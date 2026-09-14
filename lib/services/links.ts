import QRCode from "qrcode";

/** Public origin used to build shareable referral URLs. */
export function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function referralUrl(code: string, opts: { qr?: boolean } = {}): string {
  return `${appOrigin()}/r/${encodeURIComponent(code)}${opts.qr ? "?src=qr" : ""}`;
}

/** QR code as a PNG data URL. Points at the referral URL with `src=qr` so scans are tracked separately from clicks. */
export async function referralQrDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(referralUrl(code, { qr: true }), { errorCorrectionLevel: "M", margin: 1, width: 512, color: { dark: "#0f172a", light: "#ffffff" } });
}

export type ShareTargets = { whatsapp: string; twitter: string; telegram: string; facebook: string };

export function shareTargets(url: string, text: string): ShareTargets {
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    twitter: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    telegram: `https://t.me/share/url?url=${u}&text=${t}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
  };
}
