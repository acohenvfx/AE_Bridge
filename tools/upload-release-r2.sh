#!/usr/bin/env bash
# Publish the current signed DMG to the private customer-download prefix.
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
VERSION="$(python3 -c 'import json; print(json.load(open("package.json"))["version"])')"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 2
DMG="dist/AEBridge-$VERSION.dmg"
SUM="$DMG.sha256"
WRANGLER="${AEBRIDGE_WRANGLER:-$PROJECT_DIR/../Website/Pragmatic_Fox/node_modules/.bin/wrangler}"
TARGET="avid-releases-production/releases/ae-bridge/latest/AEBridge-$VERSION.dmg"
[[ -x "$WRANGLER" && -f "$DMG" && -f "$SUM" ]] || {
  echo 'Missing Wrangler, release DMG, or checksum.' >&2; exit 1;
}
shasum -a 256 -c "$SUM"
codesign --verify --verbose=2 "$DMG"
xcrun stapler validate "$PROJECT_DIR/$DMG"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export WRANGLER_SEND_METRICS=false
export WRANGLER_LOG_PATH="$WORK/wrangler.log"
"$WRANGLER" whoami
# Upload the checksum first; the DMG becomes the selected download when its
# upload completes. Leave all previous release objects available for rollback.
"$WRANGLER" r2 object put "$TARGET.sha256" --file "$SUM" --content-type text/plain --remote
"$WRANGLER" r2 object put "$TARGET" --file "$DMG" --content-type application/x-apple-diskimage --remote
"$WRANGLER" r2 object get "$TARGET" --file "$WORK/release.dmg" --remote
"$WRANGLER" r2 object get "$TARGET.sha256" --file "$WORK/release.dmg.sha256" --remote
cmp "$DMG" "$WORK/release.dmg"
cmp "$SUM" "$WORK/release.dmg.sha256"
echo "Uploaded and verified: $TARGET"
