#!/usr/bin/env python3
"""
Generate card frame overlays using OpenAI images.edits() API.
Uses existing LunchTable art assets as style reference for the zine/comic aesthetic.
Model: gpt-image-1.5 with transparent background, portrait orientation.
"""

import os
import sys
import base64
from pathlib import Path

from openai import OpenAI

PROJECT_ROOT = Path(__file__).parent.parent
ASSETS_DIR = PROJECT_ROOT / "apps" / "web" / "public" / "game-assets"
LUNCHTABLE_DIR = PROJECT_ROOT / "apps" / "web" / "public" / "lunchtable"

# Existing style reference images
INK_FRAME = LUNCHTABLE_DIR / "ink-frame.png"
CARD_BACK_REF = LUNCHTABLE_DIR / "back.png"

# Read API key from file (env var gets corrupted by shell escaping)
API_KEY = ""
key_file = PROJECT_ROOT / ".openai-key"
if key_file.exists():
    API_KEY = key_file.read_text().strip()
if not API_KEY:
    API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()

if not API_KEY:
    print("Create .openai-key file in project root or set OPENAI_API_KEY")
    sys.exit(1)

client = OpenAI(api_key=API_KEY)


def generate_edit(image_path, prompt, output_path, size="1024x1536"):
    """
    Use images.edits() with an existing image as style reference.
    gpt-image-1.5 model, transparent background, portrait orientation.
    """
    print(f"  Generating: {output_path.name}...")
    try:
        with open(image_path, "rb") as img_file:
            result = client.images.edit(
                image=img_file,
                prompt=prompt,
                model="gpt-image-1.5",
                n=1,
                size=size,
                quality="auto",
                background="transparent",
            )
        # Save the result
        if hasattr(result.data[0], "b64_json") and result.data[0].b64_json:
            img_data = base64.b64decode(result.data[0].b64_json)
            output_path.write_bytes(img_data)
            print(f"  Saved: {output_path} ({len(img_data) // 1024}KB)")
            return True
        elif hasattr(result.data[0], "url") and result.data[0].url:
            import urllib.request

            urllib.request.urlretrieve(result.data[0].url, str(output_path))
            print(f"  Saved from URL: {output_path}")
            return True
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def generate_from_scratch(prompt, output_path, size="1024x1536", background="transparent"):
    """Generate image from scratch with gpt-image-1.5."""
    print(f"  Generating: {output_path.name}...")
    try:
        result = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            n=1,
            size=size,
            quality="high",
            background=background,
        )
        img_data = base64.b64decode(result.data[0].b64_json)
        output_path.write_bytes(img_data)
        print(f"  Saved: {output_path} ({len(img_data) // 1024}KB)")
        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def main():
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    frames_dir = ASSETS_DIR / "frames"
    frames_dir.mkdir(exist_ok=True)
    board_dir = ASSETS_DIR / "board"
    board_dir.mkdir(exist_ok=True)

    # Verify reference image exists
    if not INK_FRAME.exists():
        print(f"ERROR: Reference image not found: {INK_FRAME}")
        sys.exit(1)

    print(f"Using reference image: {INK_FRAME}")
    print(f"Output directory: {frames_dir}")
    print("=== Generating Card Frame Overlays (images.edits + gpt-image-1.5) ===\n")

    # Shared style context for all prompts
    STYLE = (
        "Underground zine aesthetic, raw ink textures, imperfect brush strokes, "
        "halftone dot patterns, ink splatters, gritty comic book style, "
        "sharp angular edges, NO rounded corners, punk DIY feel. "
        "Style matches: photocopied zine, 90s underground comic, hand-drawn imperfect linework."
    )

    # CRITICAL: All frame overlays must have ZERO text/letters/numbers.
    # The code overlays variable data (name, type, stats) on top of the frame image.
    # Frame images must only provide visual structure and decoration.
    NO_TEXT = (
        "CRITICAL: Do NOT include ANY text, letters, numbers, words, labels, or writing of any kind. "
        "No 'ATK', no 'DEF', no card names, no placeholder text. "
        "The frame is a PURE VISUAL OVERLAY — all text will be added programmatically by code. "
        "Only decorative borders, divider lines, ink textures, and frame structure."
    )

    # 1. Stereotype (monster) card frame — the main creature card type
    generate_edit(
        image_path=INK_FRAME,
        prompt=(
            f"Generate a trading card game frame overlay for a creature/monster card. "
            f"Portrait orientation (3:4 aspect ratio). {STYLE} "
            f"{NO_TEXT} "
            "The frame layout from top to bottom must have these CLEAR STRUCTURAL ZONES: "
            "1. TOP 60% — A large EMPTY transparent window for character artwork. "
            "   Frame border around it: thick ink-brushstroke border in black with gold (#ffcc00) corner accents. "
            "2. MIDDLE BAND (~13% height) — A dark horizontal banner/bar area for the card name. "
            "   This band should have an ink-textured dark background with subtle gold border lines above and below. "
            "   Must be EMPTY inside (no text). "
            "3. BOTTOM ~27% — A dark area for card info. Contains: "
            "   - Two small rectangular stat boxes side by side near the bottom, "
            "     outlined with thin ink lines (left box with gold #ffcc00 border, right box with cyan #33ccff border). "
            "     These boxes must be EMPTY inside — no numbers. "
            "   - Halftone dot patterns in the dark areas as decoration. "
            "Keep the art window completely clear/transparent. "
            "Decorative elements: ink splatters at corners, halftone dots along border edges, "
            "scratchy punk line textures in the frame border areas."
        ),
        output_path=frames_dir / "frame-monster.png",
        size="1024x1536",
    )

    # 2. Spell card frame
    generate_edit(
        image_path=INK_FRAME,
        prompt=(
            f"Generate a trading card game SPELL card frame overlay. "
            f"Portrait orientation (3:4 aspect ratio). {STYLE} "
            f"{NO_TEXT} "
            "The frame layout from top to bottom must have these CLEAR STRUCTURAL ZONES: "
            "1. TOP 60% — A large EMPTY transparent window for spell artwork. "
            "   Frame border: angular ink-brushstroke border in black with cyan (#33ccff) ink accents. "
            "2. MIDDLE BAND (~13% height) — A dark horizontal banner/bar area for the card name. "
            "   Ink-textured dark background with thin cyan border lines. EMPTY inside. "
            "3. BOTTOM ~27% — A dark area for spell effect text. "
            "   Subtle ink-texture background, no boxes needed (spells don't have ATK/DEF). "
            "   Cyan (#33ccff) halftone dot decorations along the edges. "
            "Keep the art window completely clear/transparent. "
            "Spell-themed decorative elements: swirling ink energy lines around border, "
            "halftone cyan dots, angular punk motifs."
        ),
        output_path=frames_dir / "frame-spell.png",
        size="1024x1536",
    )

    # 3. Trap card frame
    generate_edit(
        image_path=INK_FRAME,
        prompt=(
            f"Generate a trading card game TRAP card frame overlay. "
            f"Portrait orientation (3:4 aspect ratio). {STYLE} "
            f"{NO_TEXT} "
            "The frame layout from top to bottom must have these CLEAR STRUCTURAL ZONES: "
            "1. TOP 60% — A large EMPTY transparent window for trap artwork. "
            "   Frame border: angular ink-brushstroke border in black with magenta (#d946ef) accents. "
            "   Warning-tape diagonal stripe motifs in the corner areas of the border. "
            "2. MIDDLE BAND (~13% height) — A dark horizontal banner/bar area for the card name. "
            "   Ink-textured dark background with magenta border lines. EMPTY inside. "
            "3. BOTTOM ~27% — A dark area for trap effect text. "
            "   No stat boxes (traps don't have ATK/DEF). "
            "   Barbed wire ink drawings along the bottom frame edge. "
            "   Magenta (#d946ef) halftone dot patterns. "
            "Keep the art window completely clear/transparent. "
            "Trap-themed decorative elements: danger stripe patterns in ink, "
            "barbed wire motifs, warning symbols drawn in halftone style."
        ),
        output_path=frames_dir / "frame-trap.png",
        size="1024x1536",
    )

    # 4. Environment card frame
    generate_edit(
        image_path=INK_FRAME,
        prompt=(
            f"Generate a trading card game ENVIRONMENT/FIELD card frame overlay. "
            f"Portrait orientation (3:4 aspect ratio). {STYLE} "
            f"{NO_TEXT} "
            "The frame layout from top to bottom must have these CLEAR STRUCTURAL ZONES: "
            "1. TOP 60% — A large EMPTY transparent window for environment artwork. "
            "   Frame border: organic ink-brushstroke border with earth-tone brown and green ink accents. "
            "2. MIDDLE BAND (~13% height) — A dark horizontal banner/bar area for the card name. "
            "   Ink-textured dark background with subtle green/brown border lines. EMPTY inside. "
            "3. BOTTOM ~27% — A dark area for environment effect text. "
            "   No stat boxes. Nature-punk motifs: thorny vines and leaf ink drawings. "
            "Keep the art window completely clear/transparent. "
            "Nature-punk decorative elements: thorny vine ink drawings creeping along frame edges, "
            "leaf silhouettes in halftone, earth-tone ink splatters."
        ),
        output_path=frames_dir / "frame-environment.png",
        size="1024x1536",
    )

    # 5. Card back design — edit from existing back.png reference
    ref_for_back = CARD_BACK_REF if CARD_BACK_REF.exists() else INK_FRAME
    generate_edit(
        image_path=ref_for_back,
        prompt=(
            "Generate a trading card game card back design in this exact art style. "
            "Portrait orientation. Underground zine / punk comic aesthetic. "
            "Central design: a stylized lunch table icon with crossed pencils, "
            "surrounded by ink splatter explosion effect and halftone dots. "
            "Letters 'LT' integrated as graffiti/tag style in the center. "
            "Color scheme: black background, gold (#ffcc00) primary, "
            "white ink splatter accents, halftone gray dots. "
            "Punk zine photocopied texture. Gritty and raw, not polished. "
            "Sharp corners. Comic book explosion energy lines radiating from center."
        ),
        output_path=frames_dir / "card-back.png",
        size="1024x1536",
    )

    # 6. Chalkboard playmat — school chalkboard with chalk graffiti doodles
    generate_from_scratch(
        prompt=(
            "Top-down view of a dark green school chalkboard surface being used as a card game table. "
            "The chalkboard has chalk graffiti doodles drawn by students: "
            "- Skull and crossbones doodles in white chalk "
            "- Stick figures fighting, band logos, anarchy symbols "
            "- Stars, lightning bolts, spirals, hearts with arrows "
            "- Faded erased areas with chalk dust residue "
            "- Some areas smudged by hands "
            "- Subtle chalk grid lines for card placement zones "
            "- 'LUNCH TABLE' scratched/written in messy chalk handwriting somewhere subtle "
            "Dark green chalkboard (#2d4a3e) base color, white and colored chalk marks. "
            "Moody overhead lighting. The doodles should feel authentic — like bored "
            "high school students drew them during class. Punk DIY energy. "
            "No cards visible — just the decorated chalkboard surface."
        ),
        output_path=board_dir / "playmat.png",
        size="1536x1024",
        background="opaque",
    )

    print("\n=== Done ===")
    generated = list(frames_dir.glob("*.png")) + list(board_dir.glob("*.png"))
    print(f"Total assets: {len(generated)}")
    for f in sorted(generated):
        size_kb = f.stat().st_size // 1024 if f.exists() else 0
        print(f"  {f.relative_to(ASSETS_DIR)} ({size_kb}KB)")


if __name__ == "__main__":
    main()
