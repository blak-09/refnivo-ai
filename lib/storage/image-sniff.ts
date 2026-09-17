/**
 * Content sniffing for uploaded images. Pure (no Next imports).
 *
 * The client-declared MIME type is never trusted: the bytes decide. Only the
 * three raster formats the product accepts are recognised; anything else —
 * including SVG (scriptable), HTML, PDF, GIF, BMP or a JPEG with an HTML
 * prefix — is rejected.
 */
export type SniffedImageType = "image/jpeg" | "image/png" | "image/webp";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(buf: Uint8Array, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) if (buf[offset + i] !== bytes[i]) return false;
  return true;
}

function ascii(buf: Uint8Array, start: number, end: number): string {
  let s = "";
  for (let i = start; i < Math.min(end, buf.length); i++) s += String.fromCharCode(buf[i]);
  return s;
}

export function sniffImageType(buf: Uint8Array): SniffedImageType | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buf, PNG)) return "image/png";
  if (buf.length >= 12 && ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return "image/webp";
  return null;
}

/**
 * True when the payload begins like markup or a script — SVG/HTML/XML/PHP and
 * friends — after an optional UTF-8 BOM and leading whitespace. Used as an
 * explicit, defence-in-depth rejection even though such files never pass the
 * signature check above.
 */
export function looksLikeMarkupOrScript(buf: Uint8Array): boolean {
  let i = 0;
  if (startsWith(buf, [0xef, 0xbb, 0xbf])) i = 3;
  while (i < buf.length && (buf[i] === 0x20 || buf[i] === 0x09 || buf[i] === 0x0a || buf[i] === 0x0d)) i++;
  const head = ascii(buf, i, i + 16).toLowerCase();
  return head.startsWith("<") || head.startsWith("#!") || head.startsWith("%pdf") || head.startsWith("mz") || head.startsWith("\x7felf");
}
