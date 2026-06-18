#!/usr/bin/env bash
# Build the game via Vite and stage the output into the target directory.
#
# Used by both the GitHub Pages workflow (bleeding edge) and the itch.io release
# workflow so the two always publish byte-identical sites.
#
# Usage: scripts/build-site.sh [output-dir]   (default: _site)
set -euo pipefail

OUTPUT_DIR="${1:-_site}"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Build via Vite (typecheck + production build → dist/)
npm run build

# Stage the Vite build output.
cp -r dist/* "$OUTPUT_DIR/"

staged_file_count=$(find "$OUTPUT_DIR" -type f | wc -l | tr -d ' ')
echo "Staged $staged_file_count files into $OUTPUT_DIR/."
