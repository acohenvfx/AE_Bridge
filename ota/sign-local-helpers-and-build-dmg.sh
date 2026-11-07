#!/usr/bin/env bash
# Run in the user's Terminal with access to their signing keychain.
# Signs local helper builds, notarizes both, stages them, then builds the DMG.
# Does not publish an OTA release or regenerate the signed AVPI.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
VERSION="$(python3 -c 'import json; print(json.load(open("package.json"))["version"])')"
BUILD_ROOT="$PROJECT_DIR/dist/local-helper-builds/$VERSION"
TEAM_ID=RRD4N3SXSG
IDENTITY="${AEBRIDGE_SIGN_IDENTITY:-${MAC_DEVELOPER_ID:-}}"
if [[ -z "$IDENTITY" ]]; then
  identities="$(security find-identity -v -p codesigning)"
  IDENTITY="$(printf '%s\n' "$identities" | sed -n 's/.*"\(Developer ID Application: .* (RRD4N3SXSG)\)".*/\1/p' | head -1)"
fi
[[ -n "$IDENTITY" ]] || { echo "FATAL: no Developer ID Application identity found for $TEAM_ID." >&2; exit 1; }
export AEBRIDGE_SIGN_IDENTITY="$IDENTITY"
export AEBRIDGE_RUNTIME_VERSION="$VERSION"
export AEBRIDGE_HELPER_VERSION="$VERSION"

NOTARY_ARGS=()
if [[ -n "${AEBRIDGE_NOTARY_PROFILE:-}" ]]; then
  NOTARY_ARGS=(--keychain-profile "$AEBRIDGE_NOTARY_PROFILE")
elif [[ -n "${MAC_NOTARY_APPLE_ID:-}" && -n "${MAC_NOTARY_PASSWORD:-}" && -n "${MAC_NOTARY_TEAM_ID:-}" ]]; then
  NOTARY_ARGS=(--apple-id "$MAC_NOTARY_APPLE_ID" --password "$MAC_NOTARY_PASSWORD" --team-id "$MAC_NOTARY_TEAM_ID")
else
  export AEBRIDGE_NOTARY_PROFILE=ACNOTARY
  NOTARY_ARGS=(--keychain-profile "$AEBRIDGE_NOTARY_PROFILE")
fi

# Check all inputs before signing either architecture.
python3 - <<'PY'
import json, zipfile
with zipfile.ZipFile('dist/AEBridge_v1.0.0.avpi') as z:
    m = json.loads(z.read('avid-manifest.json'))
    assert m['name'] == 'com.acohenvfx.aebridge'
    assert m['version'] == '1.0.0'
    assert m['uiItems'][0]['url'] == 'http://localhost:8010/app'
    assert b'<ds:Signature ' in z.comment and b'<ds:X509Certificate>' in z.comment
PY
for target in arm64 x86_64; do
  app="$BUILD_ROOT/$target/AEBridgeHelper.app"
  [[ -d "$app" ]] || { echo "FATAL: helper build missing: $app" >&2; exit 1; }
  [[ "$(lipo -archs "$app/Contents/MacOS/aebridge-helper")" == "$target" ]]
  [[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Contents/Info.plist")" == "$VERSION" ]]
done
echo "Checking notarization credentials..."
xcrun notarytool history "${NOTARY_ARGS[@]}" >/dev/null

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
for target in arm64 x86_64; do
  echo "Signing helper $VERSION for $target..."
  mkdir -p "$WORK/$target"
  app="$WORK/$target/AEBridgeHelper.app"
  ditto "$BUILD_ROOT/$target/AEBridgeHelper.app" "$app"
  # Sign every nested Mach-O before its enclosing bundle. Scripts and data
  # are sealed by the app signature rather than signed as executable code.
  while IFS= read -r -d '' item; do
    if file -b "$item" | grep -q 'Mach-O'; then
      codesign --force --options runtime --timestamp --sign "$IDENTITY" "$item"
    fi
  done < <(find "$app" -type f -print0)
  codesign --force --options runtime --timestamp --sign "$IDENTITY" "$app"
  codesign --verify --deep --strict "$app"
  actual_team="$(codesign -dv --verbose=4 "$app" 2>&1 | awk -F= '/^TeamIdentifier=/{print $2; exit}')"
  [[ "$actual_team" == "$TEAM_ID" ]] || { echo "FATAL: incorrect helper signing team." >&2; exit 1; }
  ditto -c -k --keepParent "$app" "$WORK/$target.zip"
  echo "Notarizing $target helper..."
  xcrun notarytool submit "$WORK/$target.zip" --wait "${NOTARY_ARGS[@]}"
  xcrun stapler staple "$app"
  xcrun stapler validate "$app"
  codesign --verify --deep --strict "$app"
  spctl --assess --type execute -v "$app"
done

# Replace release seeds only after both candidates have passed verification.
# Preserve prior releases under unique names so a second patch release does
# not stop merely because the first release already created a seed backup.
BACKUP_SUFFIX="before-$VERSION-$(date -u +%Y%m%dT%H%M%SZ)-$$"
for target in arm64 x86_64; do
  seed_dir="$PROJECT_DIR/dist/helper-seeds/$target"
  mkdir -p "$seed_dir"
  backup="$seed_dir/AEBridgeHelper.$BACKUP_SUFFIX.app"
  if [[ -e "$backup" ]]; then
    echo "FATAL: existing seed backup at $backup; preserve or move it before retrying." >&2
    exit 1
  fi
done
for target in arm64 x86_64; do
  seed_dir="$PROJECT_DIR/dist/helper-seeds/$target"
  if [[ -d "$seed_dir/AEBridgeHelper.app" ]]; then
    mv "$seed_dir/AEBridgeHelper.app" "$seed_dir/AEBridgeHelper.$BACKUP_SUFFIX.app"
  fi
  ditto "$WORK/$target/AEBridgeHelper.app" "$seed_dir/AEBridgeHelper.app"
done
printf '%s\n' "$VERSION" > dist/helper-seeds/version.txt
echo "Both notarized helper seeds are staged. Building the installer DMG..."
bash installer/make-dmg.sh
shasum -a 256 "dist/AEBridge-$VERSION.dmg" > "dist/AEBridge-$VERSION.dmg.sha256"
