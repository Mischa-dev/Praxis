#!/usr/bin/env bash
# sync-engine.sh — Sync engine code between Praxis and Aeth0n
#
# Praxis is the SOURCE OF TRUTH for engine code (src/).
# This script copies src/ to Aeth0n and verifies both build.
#
# Usage:
#   ./sync-engine.sh          Push Praxis src/ → Aeth0n src/
#   ./sync-engine.sh pull     Pull Aeth0n src/ → Praxis src/

set -euo pipefail

PRAXIS_DIR="$(cd "$(dirname "$0")" && pwd)"
AETH0N_DIR="/home/trident/Workspace/Projects/Aeth0n"

if [ ! -d "$AETH0N_DIR" ]; then
  echo "Error: Aeth0n directory not found at $AETH0N_DIR"
  exit 1
fi

DIRECTION="${1:-push}"

case "$DIRECTION" in
  push)
    echo "==> Syncing Praxis src/ → Aeth0n src/"
    rsync -av --delete "$PRAXIS_DIR/src/" "$AETH0N_DIR/src/"
    echo ""
    echo "==> Building Aeth0n..."
    cd "$AETH0N_DIR" && pnpm build
    echo ""
    echo "Done. Aeth0n engine synced from Praxis."
    ;;
  pull)
    echo "==> Syncing Aeth0n src/ → Praxis src/"
    rsync -av --delete "$AETH0N_DIR/src/" "$PRAXIS_DIR/src/"
    echo ""
    echo "==> Building Praxis..."
    cd "$PRAXIS_DIR" && pnpm build
    echo ""
    echo "Done. Praxis engine synced from Aeth0n."
    ;;
  *)
    echo "Usage: $0 [push|pull]"
    echo "  push (default): Praxis → Aeth0n"
    echo "  pull:           Aeth0n → Praxis"
    exit 1
    ;;
esac
