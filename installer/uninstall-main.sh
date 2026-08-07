#!/usr/bin/env bash
# AEBridge — macOS Uninstaller
# Runs as Contents/MacOS/uninstaller inside the .app bundle.
#
# Ported from DifferenceEngine's installer/uninstall-main.sh, with AEBridge's
# own label, port and paths.
set -euo pipefail

# Substituted at DMG build time (see installer/make-dmg.sh). The panel filename
# carries a version, so the uninstaller cannot guess it — but a fallback glob
# still catches a panel installed by an older DMG under a different name.
AVPI_NAME="__AVPI_NAME__"
AVID_DIR="/Library/Application Support/Avid/PanelSDKPlugins"

LABEL="com.acohenvfx.aebridge.helper"
SUPPORT_DIR="$HOME/Library/Application Support/AEBridge"
LOG_DIR="$HOME/Library/Logs/AEBridge"
HELPER_APP_PATH="$HOME/Applications/AEBridge Helper.app"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

# ── Confirm ───────────────────────────────────────────────────────────────
result=$(osascript 2>/dev/null <<'APPLESCRIPT'
tell application "System Events"
  set dlg to display dialog "Uninstall AEBridge?

This will:
  • Stop the background helper service
  • Remove the Avid panel plugin
  • Remove the helper LaunchAgent

Your plates, renders and preferences will be kept unless you choose Remove All." buttons {"Cancel", "Remove All", "Uninstall"} default button "Uninstall" with title "AEBridge Uninstaller"
  return button returned of dlg
end tell
APPLESCRIPT
)

[[ "$result" == "Cancel" ]] && exit 0

PURGE=false
[[ "$result" == "Remove All" ]] && PURGE=true

# ── Stop and remove LaunchAgent ───────────────────────────────────────────
if [[ -f "$PLIST_PATH" ]]; then
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  rm -f "$PLIST_PATH"
fi
rm -rf "$HELPER_APP_PATH"

# ── Remove the panel from Avid's plugins folder ───────────────────────────
# Collect every AEBridge panel, not just this DMG's: installing v0.0.1 and then
# v0.0.2 leaves both behind, and two panels sharing one bundle id show up twice
# in Avid's Tools menu. Other vendors' panels in the same folder are untouched.
AVPI_TARGETS=()
[[ -f "$AVID_DIR/$AVPI_NAME" ]] && AVPI_TARGETS+=("$AVID_DIR/$AVPI_NAME")
while IFS= read -r f; do
  [[ -n "$f" ]] || continue
  [[ "$f" == "$AVID_DIR/$AVPI_NAME" ]] && continue
  AVPI_TARGETS+=("$f")
done < <(find "$AVID_DIR" -maxdepth 1 \( -iname 'AE_Bridge*.avpi' -o -iname 'AEBridge*.avpi' \) 2>/dev/null)

if (( ${#AVPI_TARGETS[@]} > 0 )); then
  if [[ -w "$AVID_DIR" ]]; then
    rm -f "${AVPI_TARGETS[@]}"
  else
    QUOTED=""
    for f in "${AVPI_TARGETS[@]}"; do QUOTED+=" '$f'"; done
    osascript -e "do shell script \"rm -f$QUOTED\" with administrator privileges" 2>/dev/null || true
  fi
fi

# ── Optionally purge Application Support and logs ─────────────────────────
# Deliberately NOT the default: the support dir holds the editor's own working
# data (aep_work, exports, imported_renders.json), not just installer state.
if $PURGE; then
  rm -rf "$SUPPORT_DIR" "$LOG_DIR"
fi

# ── Done ──────────────────────────────────────────────────────────────────
osascript 2>/dev/null <<'APPLESCRIPT'
tell application "System Events"
  display dialog "AEBridge has been uninstalled.

Please restart Avid Media Composer to complete the removal." buttons {"Done"} default button "Done" with title "AEBridge Uninstaller"
end tell
APPLESCRIPT
