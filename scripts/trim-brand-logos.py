"""Trim curated brand logos for the homepage strip:  python scripts/trim-brand-logos.py

Reads public/brand-logos/<key>.png (256x256 squares), writes a tight crop to
public/brand-logos/trim/<key>.png (72 px tall) and regenerates
components/marketing/brand-logo-trim.ts with each crop's size. Wide crops are
shown as wordmarks on their own; square ones sit beside the brand name.
Run it again after adding or replacing a logo. Requires Pillow.
"""
import os
from PIL import Image

SRC = "public/brand-logos"
DARK = (17, 24, 39)  # the tile colour used behind white-on-clear logos


def content_box(img, bg, tol):
    """Bounding box of pixels that differ from the background colour by more than tol."""
    px = img.convert("RGB").load()
    w, h = img.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > tol:
                xs.append(x)
                ys.append(y)
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1) if xs else None


def trim(im):
    if im.getpixel((2, 2)) == (*DARK, 255):
        # Light artwork on the dark tile: crop to the artwork, keep the dark background.
        box = content_box(im, DARK, 60)
        if not box:
            return im
        pad = 14
        return im.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad)))
    box = im.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox() or (0, 0, im.width, im.height)
    crop = im.crop(box)
    # Remove a white box around the artwork (logos captured on white).
    rgb = Image.new("RGB", crop.size, (255, 255, 255))
    rgb.paste(crop, mask=crop.getchannel("A"))
    b2 = content_box(rgb, (255, 255, 255), 54)
    if b2 and (b2[2] - b2[0]) >= 8 and (b2[3] - b2[1]) >= 4:
        crop = crop.crop(b2)
    return crop


def main():
    os.makedirs(os.path.join(SRC, "trim"), exist_ok=True)
    sizes = {}
    for f in sorted(os.listdir(SRC)):
        if not f.endswith(".png"):
            continue
        crop = trim(Image.open(os.path.join(SRC, f)).convert("RGBA"))
        w, h = crop.size
        crop = crop.resize((max(1, round(w * 72 / h)), 72), Image.LANCZOS)
        crop.save(os.path.join(SRC, "trim", f), optimize=True)
        sizes[f[:-4]] = crop.size
    lines = [
        "// Generated from public/brand-logos by scripts/trim-brand-logos.py (see components/marketing/trusted-brands.tsx).",
        "// Trimmed copies live in public/brand-logos/trim/<key>.png; w/h are their pixel size.",
        "export const BRAND_LOGO_TRIM: Record<string, { w: number; h: number }> = {",
        *[f'  "{k}": {{ w: {w}, h: {h} }},' for k, (w, h) in sizes.items()],
        "};",
    ]
    with open("components/marketing/brand-logo-trim.ts", "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(lines) + "\n")
    print(f"trimmed {len(sizes)} logos")


if __name__ == "__main__":
    main()
