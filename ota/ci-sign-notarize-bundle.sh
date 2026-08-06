#!/usr/bin/env bash
# Sign and notarize the AEBridge helper app bundle.
#
# Port of DifferenceEngine's ota/ci-sign-notarize-bundle.sh — same Developer ID
# and notary credentials, same Team ID. Only the bundle name and identifier
# differ.
#
# Usage: ci-sign-notarize-bundle.sh <dir-containing-AEBridgeHelper.app>
set -euo pipefail

BUNDLE_DIR="${1:?usage: ci-sign-notarize-bundle.sh <bundle-dir>}"
BUNDLE_DIR="$(cd "$BUNDLE_DIR" && pwd)"
APP_BUNDLE="$BUNDLE_DIR/AEBridgeHelper.app"
APP_EXE="$APP_BUNDLE/Contents/MacOS/aebridge-helper"
BUNDLE_ID="com.acohenvfx.aebridge.helper"
EXPECTED_TEAM_ID="${AEBRIDGE_REQUIRE_TEAM_ID:-RRD4N3SXSG}"

: "${MAC_CERT_P12_BASE64:?MAC_CERT_P12_BASE64 is required}"
: "${MAC_CERT_PASSWORD:?MAC_CERT_PASSWORD is required}"
: "${MAC_DEVELOPER_ID:?MAC_DEVELOPER_ID is required}"
: "${MAC_NOTARY_APPLE_ID:?MAC_NOTARY_APPLE_ID is required}"
: "${MAC_NOTARY_TEAM_ID:?MAC_NOTARY_TEAM_ID is required}"
: "${MAC_NOTARY_PASSWORD:?MAC_NOTARY_PASSWORD is required}"

[[ -d "$APP_BUNDLE" ]] || { echo "FATAL: $APP_BUNDLE not found" >&2; exit 1; }
[[ -x "$APP_EXE" ]] || { echo "FATAL: $APP_EXE not found or not executable" >&2; exit 1; }

# Isolated keychain so signing never touches the login keychain, and is
# disposable with the runner.
KEYCHAIN="${RUNNER_TEMP:-/tmp}/aebridge-signing.keychain-db"
P12="${RUNNER_TEMP:-/tmp}/aebridge-cert.p12"
ZIP="${RUNNER_TEMP:-/tmp}/aebridge-helper-notarize.zip"

security create-keychain -p actions "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p actions "$KEYCHAIN"
security list-keychains -d user -s "$KEYCHAIN" login.keychain

printf '%s' "$MAC_CERT_P12_BASE64" | base64 --decode > "$P12"
security import "$P12" -k "$KEYCHAIN" -P "$MAC_CERT_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k actions "$KEYCHAIN"

# Trim surrounding whitespace from the identity string. A secret pasted with a
# trailing space or newline is invisible in the Actions log — GitHub masks the
# value but not the whitespace around it — and codesign then searches for an
# identity that does not exist, reporting only "no identity found". That cost a
# release run.
MAC_DEVELOPER_ID="$(printf '%s' "$MAC_DEVELOPER_ID" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

# Fail here, with the identities that ARE present, rather than inside codesign.
if ! security find-identity -v -p codesigning "$KEYCHAIN" | grep -qF "$MAC_DEVELOPER_ID"; then
  echo "FATAL: MAC_DEVELOPER_ID does not match any identity in the signing keychain." >&2
  echo "Identities available after importing the .p12:" >&2
  security find-identity -v -p codesigning "$KEYCHAIN" >&2
  echo "Check MAC_DEVELOPER_ID matches one of the names above EXACTLY, e.g." >&2
  echo "  Developer ID Application: Your Name (TEAMID)" >&2
  exit 1
fi

sign_item() {
  local identifier="${2:-}"
  if [[ -n "$identifier" ]]; then
    codesign --force --options runtime --timestamp \
      --identifier "$identifier" \
      --sign "$MAC_DEVELOPER_ID" --keychain "$KEYCHAIN" "$1"
    return
  fi
  codesign --force --options runtime --timestamp \
    --sign "$MAC_DEVELOPER_ID" --keychain "$KEYCHAIN" "$1"
}

# Inside-out: every nested Mach-O first (deepest last-modified wins via the
# reverse sort), then the main executable, then the bundle envelope. Signing
# the envelope first would be invalidated by every nested signature after it.
# This also covers a bundled ffprobe, which is why it must be signed here
# rather than trusted from wherever it was downloaded.
while IFS= read -r -d '' f; do
  [[ "$f" == "$APP_EXE" ]] && continue
  sign_item "$f"
done < <(find "$APP_BUNDLE" -type f \( -perm -111 -o -name '*.dylib' -o -name '*.so' \) -print0 | sort -rz)

sign_item "$APP_EXE" "$BUNDLE_ID"
sign_item "$APP_BUNDLE" "$BUNDLE_ID"
codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"

ditto -c -k --keepParent "$APP_BUNDLE" "$ZIP"
xcrun notarytool submit "$ZIP" --wait \
  --apple-id "$MAC_NOTARY_APPLE_ID" \
  --password "$MAC_NOTARY_PASSWORD" \
  --team-id "$MAC_NOTARY_TEAM_ID"

xcrun stapler staple "$APP_BUNDLE"
xcrun stapler validate "$APP_BUNDLE"
codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"

# Assert the identity the launcher will verify at download time. A bundle
# signed by the wrong team would install and then be rejected on the artist's
# machine, which is a far more confusing failure than one here.
ACTUAL_TEAM_ID="$(codesign -dv --verbose=4 "$APP_BUNDLE" 2>&1 | awk -F= '/^TeamIdentifier=/{print $2; exit}')"
if [[ "$ACTUAL_TEAM_ID" != "$MAC_NOTARY_TEAM_ID" ]]; then
  echo "FATAL: signed helper TeamIdentifier is $ACTUAL_TEAM_ID, expected $MAC_NOTARY_TEAM_ID" >&2
  exit 1
fi
if [[ "$ACTUAL_TEAM_ID" != "$EXPECTED_TEAM_ID" ]]; then
  echo "FATAL: signed helper TeamIdentifier is $ACTUAL_TEAM_ID, required product team is $EXPECTED_TEAM_ID" >&2
  exit 1
fi

spctl --assess --type execute --verbose=2 "$APP_BUNDLE"
echo "OK: $APP_BUNDLE signed, notarized and stapled (team $ACTUAL_TEAM_ID)"
