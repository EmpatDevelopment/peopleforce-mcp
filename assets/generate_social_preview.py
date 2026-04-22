"""
Generate assets/social-preview.png — 1280×640 GitHub social preview
for peopleforce-mcp, following the "Connective Silence" philosophy.

Run from the repo root:  python3 assets/generate_social_preview.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "social-preview.png"

W, H = 1280, 640
# Off-black feels warmer and avoids banding.
BG = (11, 11, 12)
DOT = (54, 54, 56)
DOT_EDGE = (64, 64, 66)
ACCENT = (228, 190, 125)  # amber — the one measured breath of warmth
TEXT = (239, 236, 229)
SUBTLE = (112, 112, 110)
HAIRLINE = (70, 70, 72)


def font(size: int, weight: str = "regular") -> ImageFont.ImageFont:
    """Load Helvetica Neue at a given size, falling back to default."""
    path = "/System/Library/Fonts/HelveticaNeue.ttc"
    # Index map verified on macOS (ImageFont.getname() per index):
    #   0 Regular, 1 Bold, 2 Italic, 3 BoldItalic,
    #   4 CondensedBold, 5 UltraLight, 6 UltraLightItalic,
    #   7 Light, 8 LightItalic, 9 CondensedBlack,
    #   10 Medium, 11 MediumItalic, 12 Thin, 13 ThinItalic
    idx = {"thin": 12, "light": 7, "regular": 0, "medium": 10, "bold": 1}.get(weight, 0)
    try:
        return ImageFont.truetype(path, size, index=idx)
    except Exception:
        return ImageFont.load_default()


def avenir(size: int, weight: str = "light") -> ImageFont.ImageFont:
    """Avenir is used for the display title — cleaner at large sizes than Helvetica."""
    path = "/System/Library/Fonts/Avenir.ttc"
    # 0=Book, 6=Light, 8=Medium, 11=Roman
    idx = {"light": 6, "book": 0, "medium": 8, "roman": 11}.get(weight, 6)
    try:
        return ImageFont.truetype(path, size, index=idx)
    except Exception:
        return ImageFont.load_default()


def draw_dot(draw: ImageDraw.ImageDraw, x: float, y: float, r: float, fill) -> None:
    draw.ellipse((x - r, y - r, x + r, y + r), fill=fill)


def main() -> None:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    # ─── Top ribbon: minimal category mark ────────────────────────────────────
    ribbon_y = 80
    draw.text(
        (80, ribbon_y),
        "MODEL  CONTEXT  PROTOCOL   ·   HR  SERVER",
        fill=SUBTLE,
        font=font(12, "medium"),
    )
    # Small square marker to the left of the ribbon, like a reference tick.
    draw.rectangle((60, ribbon_y + 2, 72, ribbon_y + 10), fill=SUBTLE)

    # ─── Grid of records (left): 8 × 5 = 40 dots ──────────────────────────────
    cols, rows = 8, 5
    step = 30
    grid_left = 100
    grid_top = 210
    dot_r = 2.0
    accent_col, accent_row = 7, 2  # right-middle dot is "the one that speaks"
    accent_x = grid_left + accent_col * step
    accent_y = grid_top + accent_row * step

    for r_i in range(rows):
        for c_i in range(cols):
            x = grid_left + c_i * step
            y = grid_top + r_i * step
            if r_i == accent_row and c_i == accent_col:
                # Halo: thin outer ring to let this node breathe.
                draw.ellipse(
                    (x - 7, y - 7, x + 7, y + 7),
                    outline=ACCENT,
                    width=1,
                )
                draw_dot(draw, x, y, 2.8, ACCENT)
            else:
                draw_dot(draw, x, y, dot_r, DOT)

    # ─── The line: the protocol, drawn once, with confidence ──────────────────
    line_y = accent_y
    line_start_x = accent_x + 12
    line_end_x = 700
    # Main hairline
    draw.line([(line_start_x, line_y), (line_end_x, line_y)], fill=ACCENT, width=1)
    # Tiny terminal mark at the end, like the nib of a drafting pen
    draw.line([(line_end_x, line_y - 3), (line_end_x, line_y + 3)], fill=ACCENT, width=1)

    # Axis ticks along the line — echo of technical diagrams, very quiet
    tick_xs = [
        line_start_x + int((line_end_x - line_start_x) * p)
        for p in (0.33, 0.66)
    ]
    for tx in tick_xs:
        draw.line([(tx, line_y - 2), (tx, line_y + 2)], fill=HAIRLINE, width=1)

    # ─── Right column: the title — size auto-fit so it never clips ────────────
    title_x = 740
    title_right_max = W - 80  # 1200
    available = title_right_max - title_x  # 460
    base_name = "peopleforce"
    tail = "-mcp"
    # Iterate down from 64pt until the full title fits within 'available'
    size = 64
    while size >= 32:
        f = avenir(size, "light")
        total_w = draw.textlength(base_name + tail, font=f)
        if total_w <= available:
            break
        size -= 2
    title_font = avenir(size, "light")
    # Vertical centering on the line
    ascent, descent = title_font.getmetrics()
    title_h = ascent + descent
    title_y = line_y - title_h // 2 + 2

    draw.text((title_x, title_y), base_name, fill=TEXT, font=title_font)
    name_w = draw.textlength(base_name, font=title_font)
    draw.text((title_x + name_w, title_y), tail, fill=ACCENT, font=title_font)

    # A hairline under the title reinforces the diagram feel.
    underline_y = title_y + title_h + 6
    draw.line(
        [(title_x, underline_y), (title_x + name_w + draw.textlength(tail, font=title_font), underline_y)],
        fill=HAIRLINE,
        width=1,
    )

    # Tagline below — whispered, not announced
    draw.text(
        (title_x, underline_y + 16),
        "HR  CONTEXT  FOR  CLAUDE,  CURSOR,  AND  ANY  LLM  AGENT",
        fill=SUBTLE,
        font=font(13, "medium"),
    )

    # ─── Bottom coordinates: like a map legend ────────────────────────────────
    bottom_y = H - 78
    # Left foot: the technical facts
    draw.text(
        (80, bottom_y),
        "28  READ-ONLY  TOOLS",
        fill=TEXT,
        font=font(13, "medium"),
    )
    draw.text(
        (80, bottom_y + 22),
        "PEOPLEFORCE  v3  API   ·   NODE  18+   ·   MIT",
        fill=SUBTLE,
        font=font(12, "regular"),
    )

    # Right foot: the signature — tiny, capped, letter-spaced
    sig_font = font(12, "medium")
    sig_text = "B U I L T   B Y   E M P A T"
    sig_w = draw.textlength(sig_text, font=sig_font)
    draw.text(
        (W - 80 - sig_w, bottom_y + 22),
        sig_text,
        fill=SUBTLE,
        font=sig_font,
    )
    # Small accent square before the signature
    square_size = 8
    draw.rectangle(
        (
            W - 80 - sig_w - 18,
            bottom_y + 24,
            W - 80 - sig_w - 18 + square_size,
            bottom_y + 24 + square_size,
        ),
        fill=ACCENT,
    )

    # Top-right: repo locator, like a shelf mark in an archive
    locator_font = font(11, "regular")
    locator_text = "EMPATDEVELOPMENT / PEOPLEFORCE-MCP"
    locator_w = draw.textlength(locator_text, font=locator_font)
    draw.text((W - 80 - locator_w, ribbon_y), locator_text, fill=SUBTLE, font=locator_font)
    # Tiny square marker on the right ribbon too, for symmetry
    draw.rectangle(
        (W - 80 - locator_w - 16, ribbon_y + 2, W - 80 - locator_w - 4, ribbon_y + 10),
        outline=SUBTLE,
        width=1,
    )

    # ─── Save optimized ───────────────────────────────────────────────────────
    img.save(OUT, format="PNG", optimize=True)
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.1f} KB, {W}×{H})")


if __name__ == "__main__":
    main()
