#!/usr/bin/env bash
#
# install-main.sh — body of the AEBridge installer app.
#
# Runs from inside AEBridge Installer.app on the mounted DMG. Installs:
#   ~/Applications/AEBridge Helper.app                  (seed; the launcher
#                                                        updates it thereafter)
#   ~/Library/Application Support/AEBridge/AEBridgeLauncher.sh
#   ~/Library/LaunchAgents/com.acohenvfx.aebridge.helper.plist
#   /Library/Application Support/Avid/PanelSDKPlugins/<panel>.avpi  (admin)
#
# Every target is overridable so the whole flow can be exercised into a temp
# directory — see tests. Nothing here writes outside those four locations.
set -euo pipefail

LABEL="com.acohenvfx.aebridge.helper"

# Resources dir: inside the .app when installed, or passed explicitly in tests.
RESOURCES="${AEBRIDGE_INSTALL_RESOURCES:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../Resources" 2>/dev/null && pwd || true)}"

APP_DIR="${AEBRIDGE_INSTALL_APP_DIR:-$HOME/Applications}"
SUPPORT_DIR="${AEBRIDGE_INSTALL_SUPPORT_DIR:-$HOME/Library/Application Support/AEBridge}"
AGENTS_DIR="${AEBRIDGE_INSTALL_AGENTS_DIR:-$HOME/Library/LaunchAgents}"
AVID_DIR="${AEBRIDGE_INSTALL_AVID_DIR:-/Library/Application Support/Avid/PanelSDKPlugins}"
LOG_DIR="${AEBRIDGE_INSTALL_LOG_DIR:-$HOME/Library/Logs/AEBridge}"

SKIP_LAUNCHCTL="${AEBRIDGE_INSTALL_SKIP_LAUNCHCTL:-0}"
SKIP_AVPI="${AEBRIDGE_INSTALL_SKIP_AVPI:-0}"

APP_PATH="$APP_DIR/AEBridge Helper.app"
LAUNCHER_PATH="$SUPPORT_DIR/AEBridgeLauncher.sh"
PLIST_PATH="$AGENTS_DIR/$LABEL.plist"

log() { printf '[AEBridge Installer] %s\n' "$*"; }
die() { printf '[AEBridge Installer] FATAL: %s\n' "$*" >&2; exit 1; }

# `xattr -r` is not available on every macOS version (it errors with "option -r
# not recognized"), so recurse with find instead — same approach the launcher
# uses. Quarantine must be cleared or Gatekeeper blocks the copied bundle.
strip_quarantine() {
  local target="$1"
  [[ -e "$target" ]] || return 0
  if [[ -d "$target" ]]; then
    find "$target" -exec xattr -d com.apple.quarantine {} + 2>/dev/null || true
  else
    xattr -d com.apple.quarantine "$target" 2>/dev/null || true
  fi
}

[[ -n "$RESOURCES" && -d "$RESOURCES" ]] || die "installer resources not found"

# --- 1. stop anything already running ---------------------------------------
# Unload before replacing files: launchd would otherwise keep the old helper
# alive holding port 8010, and the new one would fail to bind.
if [[ "$SKIP_LAUNCHCTL" != "1" ]]; then
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
fi

# --- 2. seed helper app ------------------------------------------------------
# Shipping a helper in the DMG means first launch works without waiting on a
# download — an edit bay may have no internet at all.
SEED_APP="$RESOURCES/helper/AEBridgeHelper.app"
if [[ -d "$SEED_APP" ]]; then
  log "installing helper -> $APP_PATH"
  mkdir -p "$APP_DIR"
  rm -rf "$APP_PATH.old"
  [[ -d "$APP_PATH" ]] && mv "$APP_PATH" "$APP_PATH.old"
  if ! cp -R "$SEED_APP" "$APP_PATH"; then
    [[ -d "$APP_PATH.old" ]] && mv "$APP_PATH.old" "$APP_PATH"
    die "could not install the helper app"
  fi
  rm -rf "$APP_PATH.old"
  strip_quarantine "$APP_PATH"
else
  log "no seeded helper in the DMG; the launcher will download one on first run"
fi

# --- 3. launcher -------------------------------------------------------------
[[ -f "$RESOURCES/AEBridgeLauncher.sh" ]] || die "launcher missing from the DMG"
log "installing launcher -> $LAUNCHER_PATH"
mkdir -p "$SUPPORT_DIR" "$LOG_DIR"
cp "$RESOURCES/AEBridgeLauncher.sh" "$LAUNCHER_PATH"
chmod +x "$LAUNCHER_PATH"
strip_quarantine "$LAUNCHER_PATH"

# --- 4. launchd job ----------------------------------------------------------
TEMPLATE="$RESOURCES/$LABEL.plist.template"
[[ -f "$TEMPLATE" ]] || die "launchd template missing from the DMG"
log "installing launchd job -> $PLIST_PATH"
mkdir -p "$AGENTS_DIR"
# The template's placeholders are absolute paths that only exist post-install.
sed -e "s|__LAUNCHER_PATH__|$LAUNCHER_PATH|g" \
    -e "s|__LOG_DIR__|$LOG_DIR|g" \
    "$TEMPLATE" > "$PLIST_PATH"
plutil -lint "$PLIST_PATH" >/dev/null || die "generated launchd plist is invalid"

# --- 5. Avid panel -----------------------------------------------------------
# /Library is not user-writable, so this is the one step needing admin. Ask
# once, via a single osascript call, rather than escalating the whole installer.
AVPI_SRC="$(find "$RESOURCES/avpi" -maxdepth 1 -name '*.avpi' 2>/dev/null | head -1)"
if [[ "$SKIP_AVPI" == "1" ]]; then
  log "skipping panel install (AEBRIDGE_INSTALL_SKIP_AVPI=1)"
elif [[ -n "$AVPI_SRC" ]]; then
  AVPI_NAME="$(basename "$AVPI_SRC")"
  log "installing panel -> $AVID_DIR/$AVPI_NAME (administrator password required)"
  if [[ -w "$(dirname "$AVID_DIR")" || -w "$AVID_DIR" ]]; then
    mkdir -p "$AVID_DIR"
    cp "$AVPI_SRC" "$AVID_DIR/$AVPI_NAME"
    strip_quarantine "$AVID_DIR/$AVPI_NAME"
  else
    osascript -e "do shell script \"mkdir -p '$AVID_DIR' && cp '$AVPI_SRC' '$AVID_DIR/$AVPI_NAME' && (xattr -d com.apple.quarantine '$AVID_DIR/$AVPI_NAME' 2>/dev/null || true)\" with administrator privileges" \
      || die "panel install was cancelled or failed"
  fi
else
  log "no .avpi in the DMG; skipping panel install"
fi

# --- 6. start ----------------------------------------------------------------
if [[ "$SKIP_LAUNCHCTL" != "1" ]]; then
  log "starting the helper"
  launchctl load "$PLIST_PATH" || die "could not load the launchd job"
  launchctl kickstart -kp "gui/$(id -u)/$LABEL" 2>/dev/null || true

  # Confirm it actually came up rather than declaring success blindly.
  for _ in $(seq 1 20); do
    if curl -sf --max-time 2 http://127.0.0.1:8010/healthz >/dev/null 2>&1; then
      log "helper is responding on 127.0.0.1:8010"
      break
    fi
    sleep 1
  done
  curl -sf --max-time 2 http://127.0.0.1:8010/healthz >/dev/null 2>&1 \
    || log "WARNING: the helper did not respond yet — check $LOG_DIR/helper.err.log"
fi

log "done. Restart Media Composer, then open Tools > AEBridge."
