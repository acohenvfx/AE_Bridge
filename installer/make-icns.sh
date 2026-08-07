#!/usr/bin/env bash
# Converts a source image to installer/AppIcon.icns using macOS sips + iconutil.
# Run once whenever the icon changes. Ported from ElementalBender's
# installer/make-icns.sh; the only difference is the source.
#
# Usage:  bash installer/make-icns.sh
#
# Source, in precedence order:
#   AEBRIDGE_ICON_PNG=/path/to/icon.png   an explicit PNG (ideally 1024x1024)
#   src/static/application.svg            the panel's own icon, rendered with
#                                         rsvg-convert
#
# EB and DE each point at a hand-made PNG. AEBridge has no such asset, but it
# does have the panel icon as SVG — which is the same artwork the editor sees in
# Avid's Tools menu, so the installer matching it is the right default rather
# than a placeholder.
set -euo pipefail

OUT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$OUT_DIR/.." && pwd)"
ICONSET="$OUT_DIR/AppIcon.iconset"
ICNS="$OUT_DIR/AppIcon.icns"
SRC_SVG="$PROJECT_DIR/src/static/application.svg"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [[ -n "${AEBRIDGE_ICON_PNG:-}" ]]; then
  [[ -f "$AEBRIDGE_ICON_PNG" ]] || { echo "ERROR: $AEBRIDGE_ICON_PNG not found" >&2; exit 1; }
  SRC_PNG="$AEBRIDGE_ICON_PNG"
  echo "Building iconset from: $SRC_PNG"
else
  [[ -f "$SRC_SVG" ]] || { echo "ERROR: $SRC_SVG not found" >&2; exit 1; }
  command -v rsvg-convert >/dev/null 2>&1 || {
    echo "ERROR: rsvg-convert not found (brew install librsvg), or set AEBRIDGE_ICON_PNG" >&2
    exit 1
  }
  SRC_PNG="$WORK/icon-1024.png"
  # Render well above the largest slot so every downscale is a reduction; sips
  # upscaling a 128px SVG export would be visibly soft at 512 and 1024.
  rsvg-convert -w 1024 -h 1024 "$SRC_SVG" -o "$SRC_PNG"
  echo "Building iconset from: $SRC_SVG (rendered at 1024x1024)"
fi

rm -rf "$ICONSET"
mkdir -p "$ICONSET"

sips -z 16   16   "$SRC_PNG" --out "$ICONSET/icon_16x16.png"       > /dev/null
sips -z 32   32   "$SRC_PNG" --out "$ICONSET/icon_16x16@2x.png"    > /dev/null
sips -z 32   32   "$SRC_PNG" --out "$ICONSET/icon_32x32.png"       > /dev/null
sips -z 64   64   "$SRC_PNG" --out "$ICONSET/icon_32x32@2x.png"    > /dev/null
sips -z 128  128  "$SRC_PNG" --out "$ICONSET/icon_128x128.png"     > /dev/null
sips -z 256  256  "$SRC_PNG" --out "$ICONSET/icon_128x128@2x.png"  > /dev/null
sips -z 256  256  "$SRC_PNG" --out "$ICONSET/icon_256x256.png"     > /dev/null
sips -z 512  512  "$SRC_PNG" --out "$ICONSET/icon_256x256@2x.png"  > /dev/null
sips -z 512  512  "$SRC_PNG" --out "$ICONSET/icon_512x512.png"     > /dev/null
sips -z 1024 1024 "$SRC_PNG" --out "$ICONSET/icon_512x512@2x.png"  > /dev/null

iconutil -c icns "$ICONSET" -o "$ICNS"
rm -rf "$ICONSET"

echo "Created: $ICNS"
