#!/usr/bin/env python3
"""
Generate the Arch PEM app icon.

Design:
  - Dark indigo gradient background, rounded corners (no white fringe ever)
  - Gold architectural arch + columns + base (represents "Arch Consultancy")
  - Three indigo/violet bar-chart bars inside the arch (Project Expense Manager)
  - Subtle golden glow around the arch
  - Drawn at 2048x2048 then LANCZOS-downscaled to 1024x1024 for crisp edges
"""

from PIL import Image, ImageDraw, ImageFilter
import math, os

# ── Resolution ────────────────────────────────────────────────────────────────
SCALE = 2          # super-sample factor
S     = 1024 * SCALE
OUT   = 1024
CR    = 190 * SCALE  # rounded-corner radius

def sc(n): return int(n * SCALE)

# ── Palette ───────────────────────────────────────────────────────────────────
BG_TOP  = (9,  6,  38)    # near-black indigo
BG_BOT  = (6, 16,  62)    # deep navy
GOLD    = (245, 158, 11)  # amber-500
BAR_L   = ( 99, 102, 241) # indigo-500   (left bar)
BAR_C   = (124,  58, 237) # violet-600   (center, tallest)
BAR_R   = (139,  92, 246) # violet-500   (right bar)

# ── Layout (all in 1x coords, sc() converts to 2x) ───────────────────────────
CX, CY   = sc(512), sc(452)   # arch-circle centre
R_OUT    = sc(298)             # outer arch radius
R_IN     = sc(226)             # inner arch radius  →  ring = 72 px thick
P_BOT    = sc(820)             # bottom of columns
BASE_H   = sc(16)              # height of base platform
BAR_BOT  = sc(806)             # bars bottom edge (sits on base)
BAR_W    = sc(72)
BAR_GAP  = sc(24)
BARS     = [
    (sc(202), BAR_L),
    (sc(310), BAR_C),   # tallest – centre
    (sc(228), BAR_R),
]

# ── Helpers ───────────────────────────────────────────────────────────────────
def arch_ring(cx, cy, ro, ri, steps=200):
    """Polygon for a semicircular arch ring (opens downward)."""
    def pt(r, deg):
        a = math.radians(deg)
        return (cx + r * math.cos(a), cy + r * math.sin(a))
    outer = [pt(ro, 180 + i * 180 / steps) for i in range(steps + 1)]
    inner = [pt(ri, 360 - i * 180 / steps) for i in range(steps + 1)]
    return outer + inner

def lerp_col(c1, c2, t):
    return tuple(round(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

# ── Build image ───────────────────────────────────────────────────────────────
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))

# 1. Background – vertical gradient + rounded-corner mask
bg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
bd = ImageDraw.Draw(bg)
for y in range(S):
    t = y / (S - 1)
    c = lerp_col(BG_TOP, BG_BOT, t) + (255,)
    bd.line([(0, y), (S - 1, y)], fill=c)
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=CR, fill=255)
bg.putalpha(mask)
img.paste(bg, (0, 0), bg)

# 2. Soft golden glow around arch + columns + base
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
gd   = ImageDraw.Draw(glow, 'RGBA')
PAD  = sc(32)
ALPHA_GLOW = 58

gd.polygon(arch_ring(CX, CY, R_OUT + PAD, R_IN - PAD), fill=(*GOLD, ALPHA_GLOW))
gd.rectangle([CX - R_OUT - PAD, CY - sc(10), CX - R_IN + PAD, P_BOT + sc(20)], fill=(*GOLD, ALPHA_GLOW))
gd.rectangle([CX + R_IN - PAD, CY - sc(10), CX + R_OUT + PAD, P_BOT + sc(20)], fill=(*GOLD, ALPHA_GLOW))
gd.rectangle([CX - R_OUT - PAD, P_BOT - sc(5), CX + R_OUT + PAD, P_BOT + BASE_H + sc(30)], fill=(*GOLD, ALPHA_GLOW))

glow = glow.filter(ImageFilter.GaussianBlur(radius=sc(36)))
img  = Image.alpha_composite(img, glow)
draw = ImageDraw.Draw(img, 'RGBA')

# 3. Arch ring (semicircle top)
draw.polygon(arch_ring(CX, CY, R_OUT, R_IN), fill=(*GOLD, 255))

# 4. Left column
draw.rectangle([CX - R_OUT, CY, CX - R_IN, P_BOT], fill=(*GOLD, 255))

# 5. Right column
draw.rectangle([CX + R_IN, CY, CX + R_OUT, P_BOT], fill=(*GOLD, 255))

# 6. Base platform (slightly wider than the columns)
draw.rounded_rectangle(
    [CX - R_OUT - sc(18), P_BOT, CX + R_OUT + sc(18), P_BOT + BASE_H],
    radius=sc(5), fill=(*GOLD, 255)
)

# 7. Bar chart (three bars inside the arch opening)
total_bar_w = len(BARS) * BAR_W + (len(BARS) - 1) * BAR_GAP
start_x = CX - total_bar_w // 2
for i, (h, col) in enumerate(BARS):
    x0 = start_x + i * (BAR_W + BAR_GAP)
    x1 = x0 + BAR_W
    y0 = BAR_BOT - h
    y1 = BAR_BOT
    draw.rounded_rectangle([x0, y0, x1, y1], radius=sc(10), fill=(*col, 255))

    # Subtle highlight strip on top of each bar
    hi_h = sc(6)
    hi_col = lerp_col(col, (255, 255, 255), 0.35)
    draw.rounded_rectangle([x0, y0, x1, y0 + hi_h], radius=sc(10), fill=(*hi_col, 200))

# 8. Keystone circle at arch crown (decorative, matches arch style)
ks_y = CY - R_OUT - sc(22)
ks_r = sc(20)
draw.ellipse([CX - ks_r, ks_y - ks_r, CX + ks_r, ks_y + ks_r],
             fill=(*lerp_col(GOLD, (255, 255, 255), 0.45), 255))

# ── Downscale & save ──────────────────────────────────────────────────────────
img = img.resize((OUT, OUT), Image.LANCZOS)

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out_path = os.path.join(root, 'public', 'icon.png')
img.save(out_path, 'PNG')
print('Saved:', out_path)
