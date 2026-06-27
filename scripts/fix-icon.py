"""
Fix white-fringe artifacts on icon.png caused by exporting from a design tool
(Figma, Sketch, etc.) that blends alpha against white instead of the icon's
own dark background.

The fix: composite the icon over its own dominant opaque background colour so
that semi-transparent edge pixels are blended correctly, then save a fresh copy
with a clean alpha channel.
"""

from PIL import Image
import os, sys

SRC  = os.path.join(os.path.dirname(__file__), '..', 'public', 'icon.png')
DEST = SRC  # overwrite in-place

img = Image.open(SRC).convert('RGBA')
w, h = img.size

# ── detect the dominant background colour from the opaque pixels ──────────────
from collections import Counter
pixels = list(img.getdata())
opaque = [(r, g, b) for r, g, b, a in pixels if a > 200]
if not opaque:
    print('No opaque pixels found — icon may already be fully transparent.')
    sys.exit(1)

# Use the most-common colour bucket (rounded to nearest 8 to avoid noise)
def bucket(v): return (v >> 3) << 3
bucketed = [(bucket(r), bucket(g), bucket(b)) for r, g, b in opaque]
bg_bucket = Counter(bucketed).most_common(1)[0][0]
print(f'Detected background colour: rgb{bg_bucket}')

# Create a solid background layer using the detected colour
bg = Image.new('RGBA', (w, h), (*bg_bucket, 255))

# Composite: icon (with original alpha) over the solid background
# This replaces the white-fringed semi-transparent pixels with correctly
# dark-blended pixels, then we restore the original alpha shape.
orig_alpha = img.getchannel('A')
composite  = Image.alpha_composite(bg, img)

# Put the original alpha back so the icon stays transparent outside the shape
composite.putalpha(orig_alpha)

composite.save(DEST, 'PNG')
print(f'Saved fixed icon → {os.path.abspath(DEST)}')
print('Done — rebuild the app to pick up the new icon.')
