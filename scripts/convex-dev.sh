#!/usr/bin/env bash
# Run convex dev under real Node (not Bun) to avoid WebSocket incompatibility.
# `bun run` prepends a fake `node` shim to PATH. Strip those entries.
CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '/bun-node' | tr '\n' ':')"
REAL_NODE="$(PATH="$CLEAN_PATH" command -v node)"
exec "$REAL_NODE" node_modules/.bin/convex "$@"
