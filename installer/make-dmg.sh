#!/usr/bin/env bash
#
# make-dmg.sh — assemble the AEBridge installer DMG.
#
# Output: dist/AEBridge-<version>.dmg containing "AEBridge Installer.app".
#
# Inputs (all optional except the launcher, which lives in the repo):
#   dist/AEBridgeHelper.app   seed helper   (build with ota/build-helper.sh)
#   dist/AEBridge.avpi        panel         (build with yarn build:panel), or
#                             AEBRIDGE_AVPI=/path/to/signed.avpi
#
# Signing is opt-in via AEBRIDGE_SIGN_IDENTITY; without it the DMG is unsigned,
# which is fine for local testing but not for distribution.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

APP_NAME="AEBridge Installer"
VOL_NAME="AEBridge"
LABEL="com.acohenvfx.aebridge.helper"

VERSION="${AEBRIDGE_RUNTIME_VERSION:-$(python3 -c 'import json;print(json.load(open("package.json"))["version"])')}"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

APP="$STAGE/$APP_NAME.app"
RES="$APP/Contents/Resources"
mkdir -p "$APP/Contents/MacOS" "$RES/helper" "$RES/avpi"

# --- installer app wrapper ---------------------------------------------------
# A plain script-backed .app rather than an Xcode project: the installer has no
# UI of its own beyond the admin prompt and Terminal output, so a compiled
# binary would add a build dependency for no benefit.
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>$APP_NAME</string>
    <key>CFBundleDisplayName</key><string>$APP_NAME</string>
    <key>CFBundleIdentifier</key><string>com.acohenvfx.aebridge.installer</string>
    <key>CFBundleExecutable</key><string>AEBridgeInstaller</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>$VERSION</string>
    <key>CFBundleVersion</key><string>$VERSION</string>
    <key>LSMinimumSystemVersion</key><string>13.0</string>
    <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# Double-clicking a .app gives no console, so re-launch in Terminal where the
# user can actually see what happened and read any error.
cat > "$APP/Contents/MacOS/AEBridgeInstaller" <<'LAUNCH'
#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BODY="$HERE/../Resources/install-main.sh"
if [[ "${AEBRIDGE_INSTALLER_IN_TERMINAL:-0}" == "1" ]]; then
  exec /bin/bash "$BODY"
fi
osascript >/dev/null 2>&1 <<APPLESCRIPT
tell application "Terminal"
    activate
    do script "AEBRIDGE_INSTALLER_IN_TERMINAL=1 /bin/bash " & quoted form of "$BODY"
end tell
APPLESCRIPT
LAUNCH
chmod +x "$APP/Contents/MacOS/AEBridgeInstaller"

# --- payload -----------------------------------------------------------------
cp installer/install-main.sh "$RES/install-main.sh"
cp ota/AEBridgeLauncher.sh "$RES/AEBridgeLauncher.sh"
cp "ota/$LABEL.plist.template" "$RES/$LABEL.plist.template"
chmod +x "$RES/install-main.sh" "$RES/AEBridgeLauncher.sh"

if [[ -d dist/AEBridgeHelper.app ]]; then
  echo "seeding helper from dist/AEBridgeHelper.app"
  cp -R dist/AEBridgeHelper.app "$RES/helper/"
else
  echo "WARNING: dist/AEBridgeHelper.app not found — the DMG will have no seeded"
  echo "         helper and first launch will require internet."
fi

AVPI="${AEBRIDGE_AVPI:-dist/AEBridge.avpi}"
if [[ -f "$AVPI" ]]; then
  echo "including panel: $AVPI"
  cp "$AVPI" "$RES/avpi/"
else
  echo "WARNING: no .avpi found at $AVPI — the panel will not be installed."
fi

# --- optional signing --------------------------------------------------------
if [[ -n "${AEBRIDGE_SIGN_IDENTITY:-}" ]]; then
  echo "signing installer app..."
  codesign --force --options runtime --timestamp \
    --sign "$AEBRIDGE_SIGN_IDENTITY" "$APP/Contents/MacOS/AEBridgeInstaller"
  codesign --force --options runtime --timestamp \
    --sign "$AEBRIDGE_SIGN_IDENTITY" "$APP"
  codesign --verify --strict --verbose=2 "$APP"
else
  echo "NOTE: AEBRIDGE_SIGN_IDENTITY unset — the installer app is unsigned."
fi

ln -s /Applications "$STAGE/Applications" 2>/dev/null || true

# --- disk image --------------------------------------------------------------
mkdir -p dist
DMG_PATH="$PROJECT_DIR/dist/AEBridge-$VERSION.dmg"
DMG_RW="$(mktemp -u)/rw.dmg"
mkdir -p "$(dirname "$DMG_RW")"
rm -f "$DMG_PATH"

# Build read-write then convert, rather than `hdiutil create -srcfolder` on a
# directory containing a .app: that path trips "Operation not permitted" on
# some systems. DifferenceEngine's make-release.sh documents the same.
SIZE_MB=$(( $(du -sm "$STAGE" | cut -f1) + 60 ))
hdiutil create -size "${SIZE_MB}m" -fs HFS+ -volname "$VOL_NAME" -ov "$DMG_RW" >/dev/null
MOUNT="$(mktemp -d)"
hdiutil attach "$DMG_RW" -mountpoint "$MOUNT" -nobrowse -noverify -noautoopen >/dev/null
cp -R "$STAGE/$APP_NAME.app" "$MOUNT/"
[[ -L "$STAGE/Applications" ]] && ln -s /Applications "$MOUNT/Applications" 2>/dev/null || true
hdiutil detach "$MOUNT" -force >/dev/null
rmdir "$MOUNT" 2>/dev/null || true
hdiutil convert "$DMG_RW" -format UDZO -imagekey zlib-level=9 -ov -o "$DMG_PATH" >/dev/null
rm -rf "$(dirname "$DMG_RW")"

if [[ -n "${AEBRIDGE_SIGN_IDENTITY:-}" ]]; then
  codesign --force --sign "$AEBRIDGE_SIGN_IDENTITY" --timestamp "$DMG_PATH"
fi

echo
echo "built $DMG_PATH ($(du -h "$DMG_PATH" | cut -f1))"
