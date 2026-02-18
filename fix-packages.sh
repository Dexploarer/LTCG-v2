#!/usr/bin/env bash
# fix-packages.sh — Nuke stale node_modules, junk dirs, and reinstall cleanly
set -euo pipefail

if [ ! -f "package.json" ] || [ ! -d ".git" ]; then
  echo "Run this script from the repository root."
  exit 1
fi

echo "=== LTCG-v2 Package Cleanup ==="

# 1. Remove junk directories left by Codex agent
echo "[1/4] Removing junk directories..."
rm -rf -- "./--with-vercel-json"
rm -rf -- "./tools/promo-video"
# Remove tools/ if empty after promo-video deletion
rmdir ./tools 2>/dev/null || true

# 2. Nuke all node_modules and stale lock artifacts (fixes platform mismatch)
echo "[2/4] Nuking node_modules + stale bun.lockb..."
while IFS= read -r -d '' modules_dir; do
  rm -rf -- "$modules_dir"
done < <(find . -type d -name node_modules -prune -print0)
rm -f -- bun.lockb

# 3. Clean install
echo "[3/4] Running bun install --frozen-lockfile..."
bun install --frozen-lockfile

# 4. Verify esbuild platform
echo "[4/4] Verifying esbuild platform..."
ESBUILD_PLATFORM=$(bun -e "console.log(process.arch + '-' + process.platform)")
echo "Platform: $ESBUILD_PLATFORM"

echo ""
echo "=== Done! ==="
echo "Next steps:"
echo "  1. Run 'npx convex dev' (will prompt browser auth if needed)"
echo "  2. Run 'bun run dev' to start both Convex + Vite"
