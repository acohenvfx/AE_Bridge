#!/usr/bin/env bash
# Converts a source image to installer/AppIcon.icns using macOS sips + iconutil.
# Run once whenever the icon changes. Ported from ElementalBender's
# installer/make-icns.sh; the only difference is the source.
#
# Usage:  bash installer/make-icns.sh
#
# Source, in precedence order:
#   AEBRIDGE_ICON_PNG=/path/to/icon.png   an explicit PNG (ideally 1024x1024)
#   Assets/AE_Bridge.png                 the AE Bridge product artwork
set -euo pipefail

OUT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$OUT_DIR/.." && pwd)"
ICONSET="$OUT_DIR/AppIcon.iconset"
ICNS="$OUT_DIR/AppIcon.icns"
SRC_PNG="${AEBRIDGE_ICON_PNG:-$PROJECT_DIR/Assets/AE_Bridge.png}"
[[ -f "$SRC_PNG" ]] || { echo "ERROR: $SRC_PNG not found" >&2; exit 1; }
echo "Building iconset from: $SRC_PNG"

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

if ! iconutil -c icns "$ICONSET" -o "$ICNS"; then
  # Some macOS environments reject an otherwise valid PNG iconset. Package
  # the same resized PNGs directly as standard ICNS image representations.
  python3 - "$ICONSET" "$ICNS" <<'PY'
import struct
import sys
from pathlib import Path

iconset = Path(sys.argv[1])
representations = [
    (b'icp4', 'icon_16x16.png'),
    (b'icp5', 'icon_32x32.png'),
    (b'icp6', 'icon_32x32@2x.png'),
    (b'ic07', 'icon_128x128.png'),
    (b'ic08', 'icon_256x256.png'),
    (b'ic09', 'icon_512x512.png'),
    (b'ic10', 'icon_512x512@2x.png'),
    (b'ic11', 'icon_16x16@2x.png'),
    (b'ic12', 'icon_32x32@2x.png'),
    (b'ic13', 'icon_128x128@2x.png'),
    (b'ic14', 'icon_256x256@2x.png'),
]
chunks = []
for kind, name in representations:
    data = (iconset / name).read_bytes()
    chunks.append(kind + struct.pack('>I', len(data) + 8) + data)
payload = b''.join(chunks)
Path(sys.argv[2]).write_bytes(b'icns' + struct.pack('>I', len(payload) + 8) + payload)
PY
fi
rm -rf "$ICONSET"

echo "Created: $ICNS"
