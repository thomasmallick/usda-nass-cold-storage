#!/usr/bin/env python3
"""
Generate assets/og-image.png (1200x630) for social unfurls.

Reads the latest grand total from data/cold-storage-archive.json so the card
shows a real number. Re-run after major data changes (the image is static —
it does not update with the monthly cron unless re-generated).

  .venv/bin/python scripts/generate-og.py
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).parent.parent
ARCHIVE = REPO / "data" / "cold-storage-archive.json"
OUT = REPO / "assets" / "og-image.png"

# Editorial Mosaic palette
PAPER = (244, 235, 220)
PAPER2 = (251, 245, 234)
INK = (17, 17, 17)
COBALT = (52, 86, 209)
CORAL = (239, 113, 50)
SUN = (220, 197, 91)
KELP = (99, 136, 82)

GRAND_TOTAL_KEYS = [
    "butter", "total_natural_cheese", "total_frozen_poultry",
    "total_frozen_fruit", "total_frozen_vegetables",
    "total_frozen_potatoes", "total_frozen_red_meat",
]


def compact_lb(thousand_lb: float) -> str:
    lb = thousand_lb * 1000
    if lb >= 1e9:
        return f"{lb / 1e9:.2f}B"
    return f"{lb / 1e6:.0f}M"


def load_font(size: int, serif: bool = True) -> ImageFont.FreeTypeFont:
    candidates = (
        ["/System/Library/Fonts/Supplemental/Iowan Old Style.ttc",
         "/System/Library/Fonts/Supplemental/Palatino.ttc",
         "/System/Library/Fonts/Supplemental/Georgia.ttf"]
        if serif else
        ["/System/Library/Fonts/Avenir Next.ttc",
         "/System/Library/Fonts/HelveticaNeue.ttc",
         "/System/Library/Fonts/Supplemental/Arial.ttf"]
    )
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default(size)


def main() -> None:
    snaps = json.loads(ARCHIVE.read_text())["snapshots"]
    latest = snaps[-1]
    total = sum(latest["commodities"].get(k, 0) for k in GRAND_TOTAL_KEYS)
    obs = latest["observationDate"][:7]

    img = Image.new("RGB", (1200, 630), PAPER)
    d = ImageDraw.Draw(img)

    # Right-edge mosaic stripe
    d.rectangle([1080, 0, 1200, 210], fill=SUN)
    d.rectangle([1080, 210, 1200, 420], fill=CORAL)
    d.rectangle([1080, 420, 1200, 630], fill=COBALT)

    # Eyebrow
    d.text((80, 84), "USDA COLD STORAGE · UPDATED MONTHLY",
           font=load_font(26, serif=False), fill=INK + (160,) if False else (90, 86, 78))

    # Title
    title_font = load_font(104)
    d.text((72, 130), "What America", font=title_font, fill=INK)
    d.text((72, 238), "keeps frozen.", font=title_font, fill=INK)

    # Hero number
    num_font = load_font(150)
    num = compact_lb(total)
    d.text((72, 392), num, font=num_font, fill=COBALT)
    num_w = d.textlength(num, font=num_font)
    d.text((84 + num_w, 480), "LB", font=load_font(40, serif=False), fill=(90, 86, 78))
    d.text((84 + num_w, 524), f"reporting {obs}", font=load_font(28, serif=False), fill=(120, 115, 105))

    OUT.parent.mkdir(exist_ok=True)
    img.save(OUT, "PNG")
    print(f"Wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
