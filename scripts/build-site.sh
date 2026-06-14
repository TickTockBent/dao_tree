#!/usr/bin/env bash
# Stage only the files the game loads at runtime into the output dir, then guard:
# every local file index.html references must actually be present in the output.
#
# Used by both the GitHub Pages workflow (bleeding edge) and the itch.io release
# workflow so the two always publish byte-identical sites.
#
# Usage: scripts/build-site.sh [output-dir]   (default: _site)
set -euo pipefail

OUTPUT_DIR="${1:-_site}"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/js/data" "$OUTPUT_DIR/js/technical" "$OUTPUT_DIR/js/utils" "$OUTPUT_DIR/js/build"

# Entry point + root image assets referenced by index.html
cp index.html options_wheel.png discord.png "$OUTPUT_DIR/"
# Stylesheets and runtime image assets (particle sprites)
cp -r css resources "$OUTPUT_DIR/"
# Root JS modules: mod, game, utils, components, and the dynamically loaded
# modFiles (layers.js, tree.js)
cp js/*.js "$OUTPUT_DIR/js/"
# Runtime JS subtrees (all .js; READMEs and fixtures left behind)
cp js/data/*.js "$OUTPUT_DIR/js/data/"
cp js/technical/*.js "$OUTPUT_DIR/js/technical/"
cp js/utils/*.js "$OUTPUT_DIR/js/utils/"
# From js/build, only the three modules loaded by index.html at runtime; the
# rest (check-all, lint-node, pacing-sim, *-node.js) is Node tooling.
cp js/build/linter.js js/build/layerFactory.js js/build/hintEngine.js "$OUTPUT_DIR/js/build/"

# --- Guard: fail the build if index.html references an unstaged local file ---
# Real HTML attributes are whitespace-prefixed (" src=" / " href="), so this
# skips Vue bindings like v-bind:href="..." / :href="..." which are not files.
missing_count=0
referenced_paths=$(grep -oE '[[:space:]](src|href)="[^"]+"' index.html \
  | sed -E 's/^[[:space:]]+(src|href)="//; s/"$//' \
  | grep -vE '^(https?:)?//|^data:|^#|^mailto:' || true)

for referenced_path in $referenced_paths; do
  if [ ! -f "$OUTPUT_DIR/$referenced_path" ]; then
    echo "::error::index.html references '$referenced_path' but it was not staged into $OUTPUT_DIR/"
    missing_count=$((missing_count + 1))
  fi
done

if [ "$missing_count" -ne 0 ]; then
  echo "Build aborted: staged site is missing $missing_count file(s) index.html needs." >&2
  exit 1
fi

staged_file_count=$(find "$OUTPUT_DIR" -type f | wc -l | tr -d ' ')
echo "Staged $staged_file_count files into $OUTPUT_DIR/; all local index.html references present."
