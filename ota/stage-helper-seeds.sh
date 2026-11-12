#!/usr/bin/env bash
# Download a pinned immutable helper release for both architectures, verify it,
# and stage it for installer/make-dmg.sh. This is deliberately version-pinned;
# release builds never consume the mutable helper-latest alias.
set -euo pipefail

VERSION="${1:-}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  echo "usage: $0 MAJOR.MINOR.PATCH" >&2
  exit 2
}

REPO="${AEBRIDGE_GH_REPO:-acohenvfx/AE_Bridge_Releases}"
TEAM_ID="${AEBRIDGE_REQUIRE_TEAM_ID:-RRD4N3SXSG}"
BASE="https://github.com/$REPO/releases/download/helper-v$VERSION"
OUT="dist/helper-seeds"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for arch in arm64 x86_64; do
  asset="AEBridgeHelper-$arch.tar.gz"
  curl -fsSL --max-time 180 -o "$TMP/$asset" "$BASE/$asset"
  curl -fsSL --max-time 30 -o "$TMP/$asset.sha256" "$BASE/$asset.sha256"
  expected="$(awk '{print $1}' "$TMP/$asset.sha256")"
  actual="$(shasum -a 256 "$TMP/$asset" | awk '{print $1}')"
  [[ "$expected" =~ ^[[:xdigit:]]{64}$ && "$actual" == "$expected" ]] || {
    echo "FATAL: checksum verification failed for $asset" >&2
    exit 1
  }
  while IFS= read -r member; do
    member="${member#./}"
    case "$member" in /*|../*|*/../*|*/..|..) echo "FATAL: unsafe archive path: $member" >&2; exit 1 ;; esac
  done < <(tar -tzf "$TMP/$asset")
  mkdir -p "$TMP/$arch"
  tar -xzf "$TMP/$asset" -C "$TMP/$arch"
  app="$TMP/$arch/AEBridgeHelper.app"
  binary="$app/Contents/MacOS/aebridge-helper"
  [[ -x "$binary" ]] || { echo "FATAL: $asset has no helper executable" >&2; exit 1; }
  lipo -archs "$binary" | tr ' ' '\n' | grep -qx "$arch" || {
    echo "FATAL: $asset does not contain $arch" >&2
    exit 1
  }
  codesign --verify --deep --strict "$app"
  team="$(codesign -dv --verbose=4 "$app" 2>&1 | awk -F= '/^TeamIdentifier=/{print $2; exit}')"
  [[ "$team" == "$TEAM_ID" ]] || { echo "FATAL: $asset Team ID is '$team'" >&2; exit 1; }
  rm -rf "$OUT/$arch"
  mkdir -p "$OUT/$arch"
  ditto "$app" "$OUT/$arch/AEBridgeHelper.app"
done

printf '%s\n' "$VERSION" > "$OUT/version.txt"
echo "staged verified helper $VERSION for arm64 and x86_64 in $OUT"
