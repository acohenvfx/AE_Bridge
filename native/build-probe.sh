#!/usr/bin/env bash
#
# build-probe.sh — compile aebridge-probe as a universal2 binary.
#
# Output: dist/native/aebridge-probe (arm64 + x86_64)
#
# Universal rather than per-arch: it is a few hundred KB, so one binary for both
# architectures is simpler than threading an arch matrix through the helper
# build for this one file.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

SRC="native/aebridge-probe.swift"
OUT_DIR="${1:-dist/native}"
OUT="$OUT_DIR/aebridge-probe"
# 13.0 matches LSMinimumSystemVersion in the helper spec.
MIN_MACOS="13.0"

command -v swiftc >/dev/null 2>&1 || {
  echo "FATAL: swiftc not found — install Xcode or the Command Line Tools." >&2
  exit 1
}

mkdir -p "$OUT_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

built=()
for arch in arm64 x86_64; do
  echo "Compiling $arch..."
  if swiftc -O -whole-module-optimization \
      -target "${arch}-apple-macos${MIN_MACOS}" \
      -o "$TMP/aebridge-probe-$arch" "$SRC" 2>"$TMP/err-$arch"; then
    built+=("$TMP/aebridge-probe-$arch")
  else
    # A host without the other arch's SDK slice can still ship its own; failing
    # the whole build over the cross slice would block local iteration.
    echo "WARNING: $arch build failed:" >&2
    sed 's/^/  /' "$TMP/err-$arch" >&2
  fi
done

[[ ${#built[@]} -gt 0 ]] || { echo "FATAL: no architecture built" >&2; exit 1; }

if [[ ${#built[@]} -gt 1 ]]; then
  lipo -create "${built[@]}" -output "$OUT"
else
  cp "${built[0]}" "$OUT"
  echo "WARNING: single-architecture probe — release builds must be universal." >&2
fi
chmod +x "$OUT"

echo "built $OUT"
lipo -info "$OUT"
