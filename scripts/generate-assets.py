#!/usr/bin/env python3
"""
Generate game assets for LunchTable TCG using OpenAI gpt-image-1.

Usage:
  python3 scripts/generate-assets.py --mode board     # Generate board assets only
  python3 scripts/generate-assets.py --mode sample    # Generate 6 sample cards (1 per deck)
  python3 scripts/generate-assets.py --mode all       # Generate all 132 card arts
  python3 scripts/generate-assets.py --mode card --name "Back Alley Bookie"  # Single card

Requires OPENAI_API_KEY environment variable.
"""

import os
import sys
import json
import base64
import argparse
from pathlib import Path

# Try imports
try:
    from openai import OpenAI
except ImportError:
    print("ERROR: pip install openai")
    sys.exit(1)

try:
    import pandas as pd
except ImportError:
    print("ERROR: pip install pandas openpyxl")
    sys.exit(1)


PROJECT_ROOT = Path(__file__).parent.parent
ASSETS_DIR = PROJECT_ROOT / "apps" / "web" / "public" / "game-assets"
CARD_ART_DIR = ASSETS_DIR / "cards"
BOARD_DIR = ASSETS_DIR / "board"
XLSX_PATH = PROJECT_ROOT / "apps" / "web" / "public" / "lunchtable" / "lunchtable_MASTER_card_database.xlsx"

# Archetype color map for card frame tinting
DECK_COLORS = {
    "Dropouts": "#ef4444",    # red
    "Preps": "#3b82f6",       # blue
    "Geeks": "#eab308",       # yellow
    "Freaks": "#a855f7",      # purple
    "Nerds": "#22c55e",       # green
    "Goodies": "#9ca3af",     # gray
}


def ensure_dirs():
    CARD_ART_DIR.mkdir(parents=True, exist_ok=True)
    BOARD_DIR.mkdir(parents=True, exist_ok=True)


def save_image(client, prompt, path, size="1024x1024", background="transparent", quality="high"):
    """Generate and save a single image."""
    print(f"  Generating: {path.name}...")
    try:
        result = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            size=size,
            background=background,
            quality=quality,
            n=1,
        )
        # gpt-image-1 returns base64
        image_data = base64.b64decode(result.data[0].b64_json)
        path.write_bytes(image_data)
        print(f"  Saved: {path} ({len(image_data) // 1024}KB)")
        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def generate_board_assets(client):
    """Generate playmat, card back, and UI textures."""
    print("\n=== Generating Board Assets ===\n")

    assets = [
        {
            "name": "playmat.png",
            "prompt": (
                "Top-down view of a dark worn leather game table surface for a trading card game. "
                "Dark brown-black leather texture with subtle scratches, wear marks, and aged patina. "
                "Faint grid lines etched into the leather marking card zones. "
                "Moody dramatic lighting from above casting subtle shadows. "
                "No cards, no text, no objects on the surface. "
                "Photorealistic texture, 4K quality, dark color palette."
            ),
            "size": "1536x1024",
            "background": "opaque",
        },
        {
            "name": "card-back.png",
            "prompt": (
                "Trading card game card back design, portrait orientation. "
                "Dark punk zine aesthetic with ink black background. "
                "Central emblem: a stylized lunch table with crossed pencils and a crown, "
                "surrounded by an ornate border of chains, spray paint drips, and torn paper edges. "
                "Text 'LT' subtly integrated into the design. "
                "Color scheme: black, dark gray, gold (#ffcc00) accents. "
                "Sharp corners, no rounded edges. Underground comic book style. "
                "High contrast, gritty xerox photocopy texture. No photograph."
            ),
            "size": "1024x1536",
            "background": "opaque",
        },
        {
            "name": "card-frame-monster.png",
            "prompt": (
                "Trading card game card frame template, portrait orientation. "
                "Ornate border design for a monster/character card. "
                "Sharp angular frame with industrial punk aesthetic - rivets, bolts, scratched metal. "
                "The center is completely empty/transparent (this is a frame overlay). "
                "Top: name plate area with angular metal banner. "
                "Middle: large empty rectangular window for character art. "
                "Bottom: stat box area with two number slots (ATK/DEF style). "
                "Color: dark gunmetal gray with gold (#ffcc00) accent lines. "
                "Sharp corners, no curves. Gritty industrial texture. Transparent background."
            ),
            "size": "1024x1536",
            "background": "transparent",
        },
        {
            "name": "card-frame-spell.png",
            "prompt": (
                "Trading card game card frame template, portrait orientation. "
                "Ornate border for a spell/magic card. "
                "Flowing angular frame with neon energy aesthetic - circuit lines, glowing edges. "
                "The center is completely empty/transparent (this is a frame overlay). "
                "Top: name plate area with angular banner. "
                "Middle: large empty window for spell art. "
                "Bottom: effect text area. "
                "Color: deep teal/cyan (#33ccff) with dark edges. "
                "Sharp corners, punk zine style. Transparent background."
            ),
            "size": "1024x1536",
            "background": "transparent",
        },
        {
            "name": "card-frame-trap.png",
            "prompt": (
                "Trading card game card frame template, portrait orientation. "
                "Ornate border for a trap card. "
                "Angular frame with barbed wire and warning stripe aesthetic. "
                "The center is completely empty/transparent (this is a frame overlay). "
                "Top: name plate area with danger-tape styled banner. "
                "Middle: large empty window for trap art. "
                "Bottom: effect text area. "
                "Color: deep magenta/pink (#d946ef) with dark edges and yellow caution stripes. "
                "Sharp corners, industrial punk. Transparent background."
            ),
            "size": "1024x1536",
            "background": "transparent",
        },
        {
            "name": "zone-glow-red.png",
            "prompt": (
                "Soft glowing red energy aura effect on transparent background. "
                "Circular/rectangular soft glow, like a neon light seen through fog. "
                "Color: warm red (#ef4444). Feathered edges fading to transparency. "
                "No solid shapes, just atmospheric light. Game UI element."
            ),
            "size": "1024x1024",
            "background": "transparent",
        },
    ]

    success = 0
    for asset in assets:
        path = BOARD_DIR / asset["name"]
        if path.exists():
            print(f"  Skipping (exists): {asset['name']}")
            success += 1
            continue
        if save_image(
            client,
            asset["prompt"],
            path,
            size=asset.get("size", "1024x1024"),
            background=asset.get("background", "transparent"),
        ):
            success += 1

    print(f"\nBoard assets: {success}/{len(assets)} generated")
    return success


def generate_card_art(client, df, card_names=None):
    """Generate card art from database prompts."""
    if card_names:
        cards = df[df["Card_Name"].isin(card_names)]
    else:
        cards = df

    print(f"\n=== Generating {len(cards)} Card Arts ===\n")

    success = 0
    for _, card in cards.iterrows():
        name = card["Card_Name"]
        card_type = card["Card_Type"]
        deck = card["Deck"]

        # Create filename from card name
        filename = name.lower().replace(" ", "_").replace("'", "").replace("-", "_") + ".png"
        path = CARD_ART_DIR / filename

        if path.exists():
            print(f"  Skipping (exists): {filename}")
            success += 1
            continue

        # Use the FirstRelease_Art_Prompt (most specific per-card)
        prompt = card.get("FirstRelease_Art_Prompt")
        if pd.isna(prompt) or not prompt:
            prompt = card.get("Custom_Art_Prompt")
        if pd.isna(prompt) or not prompt:
            prompt = card.get("Underground_Art_Prompt")
        if pd.isna(prompt) or not prompt:
            print(f"  Skipping (no prompt): {name}")
            continue

        # Add transparent background instruction
        prompt = prompt + " Transparent background, character/subject only, no background scenery."

        print(f"  [{deck}] {name} ({card_type})")
        if save_image(client, prompt, path, size="1024x1536", background="transparent"):
            success += 1

    print(f"\nCard arts: {success}/{len(cards)} generated")
    return success


def generate_sample_cards(client, df):
    """Generate 1 card per deck as samples."""
    # Pick the first Stereotype from each deck
    samples = []
    for deck in DECK_COLORS:
        deck_cards = df[(df["Deck"] == deck) & (df["Card_Type"] == "Stereotype")]
        if len(deck_cards) > 0:
            samples.append(deck_cards.iloc[0]["Card_Name"])

    print(f"Sample cards: {samples}")
    return generate_card_art(client, df, card_names=samples)


def main():
    parser = argparse.ArgumentParser(description="Generate LunchTable TCG game assets")
    parser.add_argument("--mode", choices=["board", "sample", "all", "card"], default="sample")
    parser.add_argument("--name", help="Card name for --mode card")
    args = parser.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("ERROR: Set OPENAI_API_KEY environment variable")
        sys.exit(1)

    client = OpenAI(api_key=api_key)
    ensure_dirs()

    # Load card database
    df = pd.read_excel(XLSX_PATH, sheet_name="Master Cards")
    print(f"Loaded {len(df)} cards from database")

    if args.mode == "board":
        generate_board_assets(client)
    elif args.mode == "sample":
        generate_board_assets(client)
        generate_sample_cards(client, df)
    elif args.mode == "all":
        generate_board_assets(client)
        generate_card_art(client, df)
    elif args.mode == "card":
        if not args.name:
            print("ERROR: --name required for card mode")
            sys.exit(1)
        generate_card_art(client, df, card_names=[args.name])

    # Write manifest
    manifest = {"generated": []}
    for d in [BOARD_DIR, CARD_ART_DIR]:
        for f in sorted(d.glob("*.png")):
            manifest["generated"].append(str(f.relative_to(ASSETS_DIR)))

    manifest_path = ASSETS_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"\nManifest written to {manifest_path}")
    print(f"Total assets: {len(manifest['generated'])}")


if __name__ == "__main__":
    main()
