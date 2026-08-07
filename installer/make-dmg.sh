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
# SIGNED AND NOTARIZED BY DEFAULT. The signing identity is auto-detected, and
# signing implies notarizing — there is deliberately no way to produce a signed
# but un-notarized DMG, because that is the one shape that fails silently: it
# builds cleanly, `codesign --verify` passes, and it is then REJECTED on the
# artist's machine with "source=Unnotarized Developer ID". Found exactly that
# way on 2026-08-06, on a DMG that looked finished.
#
#   AEBRIDGE_UNSIGNED=1       build unsigned, for local testing only. The
#                             unsafe path is the one you have to ask for.
#
# Notary credentials, in precedence order:
#
#   AEBRIDGE_NOTARY_PROFILE   a `xcrun notarytool store-credentials` keychain
#                             profile name — the local path, and the reason no
#                             password need ever enter the environment, a
#                             script, or shell history.
#
#   MAC_NOTARY_APPLE_ID + MAC_NOTARY_PASSWORD + MAC_NOTARY_TEAM_ID
#                             the CI path — the same variables
#                             ota/ci-sign-notarize-bundle.sh already uses, so a
#                             workflow that can release the helper can also
#                             build the DMG with no new secrets.
#
#   otherwise                 the shared ACNOTARY keychain profile. Create it
#                             once with:
#                               xcrun notarytool store-credentials ACNOTARY \
#                                 --apple-id <id> --team-id RRD4N3SXSG
#                             (it prompts for the app-specific password, which
#                             is NOT the Apple ID password)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

APP_NAME="AEBridge Installer"
UNINSTALL_NAME="Uninstall AEBridge"
VOL_NAME="AEBridge"
LABEL="com.acohenvfx.aebridge.helper"

VERSION="${AEBRIDGE_RUNTIME_VERSION:-$(python3 -c 'import json;print(json.load(open("package.json"))["version"])')}"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

SIGN_IDENTITY="${AEBRIDGE_SIGN_IDENTITY:-}"
NOTARY_ARGS=()

# The notary credential is tied to the APPLE ID, not to a product (an
# app-specific password is "specific to the tool you hand it to"), so one
# profile serves AEBridge, DifferenceEngine and ElementalBender alike. Hence a
# shared default name rather than a per-product one — the sister projects
# currently each invent their own ("EB Notary", "DE_NOTARY",
# "difference-engine-notary"), which means a rotated password has to be
# re-stored three times and, as of 2026-08-06, all three had gone stale (401)
# while the CI secret stayed valid.
NOTARY_PROFILE_DEFAULT="ACNOTARY"

# --- preflight ---------------------------------------------------------------
# Everything that can be known up front is checked here, before a build that
# ends in a notarization round trip. The CI signing script learned the same
# lesson the expensive way: fail in seconds with a named cause, not several
# minutes in with "no identity found".
#
# Signing is the DEFAULT, and the identity is auto-detected the way
# ElementalBender's sign-dmg.sh does it. Building something distributable must
# not depend on remembering to set a variable; the unsafe path is the one you
# have to ask for, via AEBRIDGE_UNSIGNED=1.
if [[ "${AEBRIDGE_UNSIGNED:-0}" == "1" ]]; then
  SIGN_IDENTITY=""
else
  if [[ -z "$SIGN_IDENTITY" ]]; then
    SIGN_IDENTITY="$(security find-identity -v -p codesigning \
      | grep 'Developer ID Application' | head -1 | sed 's/.*"\(.*\)"/\1/')"
    if [[ -z "$SIGN_IDENTITY" ]]; then
      echo "FATAL: no 'Developer ID Application' certificate in the keychain." >&2
      echo "Install one, set AEBRIDGE_SIGN_IDENTITY, or pass AEBRIDGE_UNSIGNED=1" >&2
      echo "to build an unsigned DMG for local testing." >&2
      exit 1
    fi
    echo "auto-detected signing identity: $SIGN_IDENTITY"
  fi

  # A secret pasted with a trailing newline is invisible in a log — GitHub
  # masks the value but not the whitespace around it — and codesign then
  # searches for an identity that does not exist. That cost a release run.
  SIGN_IDENTITY="$(printf '%s' "$SIGN_IDENTITY" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

  if ! security find-identity -v -p codesigning | grep -qF "$SIGN_IDENTITY"; then
    echo "FATAL: AEBRIDGE_SIGN_IDENTITY does not match any codesigning identity." >&2
    echo "Identities available:" >&2
    security find-identity -v -p codesigning >&2
    exit 1
  fi

  # Explicit profile wins; then the CI env vars; then the shared default
  # profile. The env-var branch must be checked before the default is applied,
  # or a defaulted profile name would silently shadow CI's credentials.
  if [[ -n "${AEBRIDGE_NOTARY_PROFILE:-}" ]]; then
    NOTARY_ARGS=(--keychain-profile "$AEBRIDGE_NOTARY_PROFILE")
  elif [[ -n "${MAC_NOTARY_APPLE_ID:-}" && -n "${MAC_NOTARY_PASSWORD:-}" \
          && -n "${MAC_NOTARY_TEAM_ID:-}" ]]; then
    NOTARY_ARGS=(--apple-id "$MAC_NOTARY_APPLE_ID"
                 --password "$MAC_NOTARY_PASSWORD"
                 --team-id "$MAC_NOTARY_TEAM_ID")
  else
    NOTARY_ARGS=(--keychain-profile "$NOTARY_PROFILE_DEFAULT")
  fi

  # Prove the credentials work BEFORE building. notarytool fails a bad password
  # with HTTP 401 — worth catching in seconds rather than after a full build,
  # and the likeliest failure by far: an app-specific password can be revoked
  # or rotated at any time, and a stored profile keeps working right up until
  # it doesn't.
  echo "checking notary credentials..."
  if ! NOTARY_CHECK="$(xcrun notarytool history "${NOTARY_ARGS[@]}" 2>&1 | head -5)"; then
    echo "FATAL: notary credentials were rejected. Refusing to build a DMG" >&2
    echo "that could not be notarized." >&2
    echo >&2
    echo "$NOTARY_CHECK" >&2
    echo >&2
    cat >&2 <<NOCREDS
"No Keychain password item" means the profile has not been created yet. A 401
means the app-specific password is wrong, revoked or rotated — NOT that the
Apple ID is unregistered. Either way: generate a fresh app-specific password at
appleid.apple.com (Sign-In and Security > App-Specific Passwords) — it is NOT
your Apple ID password — and store it:

  xcrun notarytool store-credentials $NOTARY_PROFILE_DEFAULT \\
    --apple-id <your-apple-developer-id> --team-id RRD4N3SXSG

Other ways in: set AEBRIDGE_NOTARY_PROFILE to an existing profile, or supply
MAC_NOTARY_APPLE_ID + MAC_NOTARY_PASSWORD + MAC_NOTARY_TEAM_ID (the values in
this repo's GitHub secrets are known good).

To build an unsigned DMG for local testing instead: AEBRIDGE_UNSIGNED=1
NOCREDS
    exit 1
  fi
fi

# Submit to Apple, staple the ticket into the artifact, and prove it took.
# Stapling is what makes the result work OFFLINE — without it Gatekeeper needs
# to reach Apple to discover the notarization, which an edit bay may not be
# able to do.
notarize_and_staple() {
  local target="$1"
  local zip=""

  echo "notarizing $(basename "$target") (this waits on Apple)..."
  if [[ -d "$target" ]]; then
    # A bundle must be zipped to be submitted; a DMG is submitted as-is.
    zip="$STAGE/$(basename "$target").notarize.zip"
    ditto -c -k --keepParent "$target" "$zip"
    xcrun notarytool submit "$zip" --wait "${NOTARY_ARGS[@]}"
    rm -f "$zip"
  else
    xcrun notarytool submit "$target" --wait "${NOTARY_ARGS[@]}"
  fi

  xcrun stapler staple "$target"
  xcrun stapler validate "$target"
}

APP="$STAGE/$APP_NAME.app"
RES="$APP/Contents/Resources"
mkdir -p "$APP/Contents/MacOS" "$RES/helper" "$RES/avpi"

# A plain script-backed .app rather than an Xcode project: the installer's UI is
# native dialogs and a Cocoa progress window driven from the shell, so a
# compiled binary would add a build dependency for no benefit. Same shape as
# DifferenceEngine's and ElementalBender's installers.
make_app_bundle() {
  local app="$1" name="$2" bundle_id="$3" exe="$4" body_src="$5" body_name="$6"
  local res="$app/Contents/Resources"
  mkdir -p "$app/Contents/MacOS" "$res"

  cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>$name</string>
    <key>CFBundleDisplayName</key><string>$name</string>
    <key>CFBundleIdentifier</key><string>$bundle_id</string>
    <key>CFBundleExecutable</key><string>$exe</string>
    <key>CFBundleIconFile</key><string>AppIcon</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>$VERSION</string>
    <key>CFBundleVersion</key><string>$VERSION</string>
    <key>LSMinimumSystemVersion</key><string>13.0</string>
    <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

  # The executable is a thin shim: Finder needs a fixed CFBundleExecutable name,
  # while the real body lives in Resources where it can be replaced without
  # touching the bundle's identity.
  cat > "$app/Contents/MacOS/$exe" <<SHIM
#!/usr/bin/env bash
set -euo pipefail
HERE="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
exec /bin/bash "\$HERE/../Resources/$body_name"
SHIM
  chmod +x "$app/Contents/MacOS/$exe"

  cp "$body_src" "$res/$body_name"
  chmod +x "$res/$body_name"

  [[ -f installer/AppIcon.icns ]] && cp installer/AppIcon.icns "$res/AppIcon.icns"
}

make_app_bundle "$APP" "$APP_NAME" "com.acohenvfx.aebridge.installer" \
  "AEBridgeInstaller" "installer/app-main.sh" "app-main.sh"

# --- uninstaller app ---------------------------------------------------------
# Ships beside the installer in the DMG, as in EB and DE. Without it the only
# way to remove AEBridge is to hand-delete a LaunchAgent, an app bundle and a
# file under /Library — which nobody will get right from memory.
UNINSTALL_APP="$STAGE/$UNINSTALL_NAME.app"
make_app_bundle "$UNINSTALL_APP" "$UNINSTALL_NAME" \
  "com.acohenvfx.aebridge.uninstaller" "AEBridgeUninstaller" \
  "installer/uninstall-main.sh" "uninstall-main.sh"

# --- payload -----------------------------------------------------------------
cp ota/AEBridgeLauncher.sh "$RES/AEBridgeLauncher.sh"
cp "ota/$LABEL.plist.template" "$RES/$LABEL.plist.template"
cp installer/install-progress.js "$RES/install-progress.js"
chmod +x "$RES/AEBridgeLauncher.sh"

if [[ -d dist/AEBridgeHelper.app ]]; then
  echo "seeding helper from dist/AEBridgeHelper.app"
  cp -R dist/AEBridgeHelper.app "$RES/helper/"
else
  echo "WARNING: dist/AEBridgeHelper.app not found — the DMG will have no seeded"
  echo "         helper and first launch will require internet."
fi

AVPI="${AEBRIDGE_AVPI:-dist/AEBridge.avpi}"
AVPI_NAME=""
if [[ -f "$AVPI" ]]; then
  AVPI_NAME="$(basename "$AVPI")"
  echo "including panel: $AVPI"
  cp "$AVPI" "$RES/avpi/"
else
  echo "WARNING: no .avpi found at $AVPI — the panel will not be installed."
fi

# The uninstaller cannot guess the panel's filename (it carries a version), so
# bake in the one this DMG ships. Its own fallback glob still catches panels
# installed by an older DMG under a different name.
UNINSTALL_BODY="$UNINSTALL_APP/Contents/Resources/uninstall-main.sh"
UNINSTALL_TMP="$STAGE/uninstall-main.substituted"
sed "s|__AVPI_NAME__|$AVPI_NAME|g" "$UNINSTALL_BODY" > "$UNINSTALL_TMP"
mv "$UNINSTALL_TMP" "$UNINSTALL_BODY"
chmod +x "$UNINSTALL_BODY"

# --- signing + notarization --------------------------------------------------
# The app is notarized and stapled BEFORE it goes into the DMG, so the ticket
# travels inside the image. Notarizing only the DMG would leave the app itself
# without a ticket once copied out of it.
#
# --options runtime (hardened runtime) is not optional: the notary service
# rejects submissions without it.
if [[ -n "$SIGN_IDENTITY" ]]; then
  echo "signing installer app..."
  codesign --force --options runtime --timestamp \
    --sign "$SIGN_IDENTITY" "$APP/Contents/MacOS/AEBridgeInstaller"
  codesign --force --options runtime --timestamp \
    --sign "$SIGN_IDENTITY" "$APP"
  codesign --verify --strict --verbose=2 "$APP"

  echo "signing uninstaller app..."
  codesign --force --options runtime --timestamp \
    --sign "$SIGN_IDENTITY" "$UNINSTALL_APP/Contents/MacOS/AEBridgeUninstaller"
  codesign --force --options runtime --timestamp \
    --sign "$SIGN_IDENTITY" "$UNINSTALL_APP"
  codesign --verify --strict --verbose=2 "$UNINSTALL_APP"

  # Both apps go to the notary service. The uninstaller is launched directly by
  # the user just like the installer, so an un-notarized one is blocked exactly
  # the same way.
  notarize_and_staple "$APP"
  notarize_and_staple "$UNINSTALL_APP"
else
  echo "NOTE: AEBRIDGE_UNSIGNED=1 — the installer app is unsigned and NOT"
  echo "      notarized. Local testing only; Gatekeeper will block this on any"
  echo "      machine that did not build it. Do not distribute."
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
cp -R "$UNINSTALL_APP" "$MOUNT/"
[[ -L "$STAGE/Applications" ]] && ln -s /Applications "$MOUNT/Applications" 2>/dev/null || true
hdiutil detach "$MOUNT" -force >/dev/null
rmdir "$MOUNT" 2>/dev/null || true
hdiutil convert "$DMG_RW" -format UDZO -imagekey zlib-level=9 -ov -o "$DMG_PATH" >/dev/null
rm -rf "$(dirname "$DMG_RW")"

if [[ -n "$SIGN_IDENTITY" ]]; then
  codesign --force --sign "$SIGN_IDENTITY" --timestamp "$DMG_PATH"
  notarize_and_staple "$DMG_PATH"

  # Assert the thing that actually matters, the way the artist's Mac will see
  # it. `codesign --verify` passing is NOT this: it says the signature is
  # intact, not that Gatekeeper will allow the thing to run. The 2026-08-06
  # DMG passed codesign and was still "rejected / Unnotarized Developer ID".
  echo
  echo "verifying Gatekeeper acceptance..."
  spctl --assess --type open --context context:primary-signature -v "$DMG_PATH"

  # And both apps inside it, mounted, exactly as the user will launch them.
  VERIFY_MOUNT="$(mktemp -d)"
  hdiutil attach "$DMG_PATH" -mountpoint "$VERIFY_MOUNT" -nobrowse -noverify -noautoopen >/dev/null
  VERIFY_FAILED=""
  for checked in "$APP_NAME" "$UNINSTALL_NAME"; do
    if ! spctl --assess --type execute -v "$VERIFY_MOUNT/$checked.app"; then
      VERIFY_FAILED="$checked.app"
      break
    fi
    xcrun stapler validate "$VERIFY_MOUNT/$checked.app" || { VERIFY_FAILED="$checked.app"; break; }
  done
  hdiutil detach "$VERIFY_MOUNT" -force >/dev/null
  rmdir "$VERIFY_MOUNT" 2>/dev/null || true
  if [[ -n "$VERIFY_FAILED" ]]; then
    echo "FATAL: $VERIFY_FAILED inside the DMG is not Gatekeeper-approved" >&2
    exit 1
  fi
  echo "OK: DMG, installer and uninstaller are signed, notarized and stapled."
fi

echo
echo "built $DMG_PATH ($(du -h "$DMG_PATH" | cut -f1))"
