#!/usr/bin/env bash
#
# AEBridge — macOS Installer
# Runs as Contents/MacOS/AEBridgeInstaller inside the .app bundle.
#
# Installs:
#   ~/Applications/AEBridge Helper.app                  (seed; the launcher
#                                                        updates it thereafter)
#   ~/Library/Application Support/AEBridge/AEBridgeLauncher.sh
#   ~/Library/LaunchAgents/com.acohenvfx.aebridge.helper.plist
#   /Library/Application Support/Avid/PanelSDKPlugins/<panel>.avpi  (admin)
#
# Ported to the DifferenceEngine/ElementalBender installer shape: a native
# welcome dialog and Cocoa progress window rather than a Terminal transcript.
# The previous version re-launched itself in Terminal.app, which showed an
# artist a wall of shell output and an admin prompt with no explanation.
#
# Every target is still overridable so the whole flow can be exercised into a
# temp directory, and AEBRIDGE_INSTALL_NONINTERACTIVE=1 suppresses every dialog
# for that case — the same escape hatch DE uses. Nothing here writes outside the
# four locations above.
set -euo pipefail

LABEL="com.acohenvfx.aebridge.helper"
HELPER_PORT=8010
TEAM_ID="${AEBRIDGE_REQUIRE_TEAM_ID-RRD4N3SXSG}"

# Resources dir: inside the .app when installed, or passed explicitly in tests.
RESOURCES="${AEBRIDGE_INSTALL_RESOURCES:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../Resources" 2>/dev/null && pwd || true)}"

APP_DIR="${AEBRIDGE_INSTALL_APP_DIR:-$HOME/Applications}"
SUPPORT_DIR="${AEBRIDGE_INSTALL_SUPPORT_DIR:-$HOME/Library/Application Support/AEBridge}"
AGENTS_DIR="${AEBRIDGE_INSTALL_AGENTS_DIR:-$HOME/Library/LaunchAgents}"
AVID_DIR="${AEBRIDGE_INSTALL_AVID_DIR:-/Library/Application Support/Avid/PanelSDKPlugins}"
LOG_DIR="${AEBRIDGE_INSTALL_LOG_DIR:-$HOME/Library/Logs/AEBridge}"

SKIP_LAUNCHCTL="${AEBRIDGE_INSTALL_SKIP_LAUNCHCTL:-0}"
SKIP_AVPI="${AEBRIDGE_INSTALL_SKIP_AVPI:-0}"
NONINTERACTIVE="${AEBRIDGE_INSTALL_NONINTERACTIVE:-0}"
ALLOW_ADHOC="${AEBRIDGE_INSTALL_ALLOW_ADHOC:-0}"
SKIP_AVID_LIFECYCLE="${AEBRIDGE_INSTALL_SKIP_AVID_LIFECYCLE:-0}"
AVID_APP_PATH="${AEBRIDGE_INSTALL_AVID_APP_PATH:-/Applications/Avid Media Composer/AvidMediaComposer.app}"

APP_PATH="$APP_DIR/AEBridge Helper.app"
LAUNCHER_PATH="$SUPPORT_DIR/AEBridgeLauncher.sh"
PLIST_PATH="$AGENTS_DIR/$LABEL.plist"

PROGRESS_FILE=""
PROGRESS_PID=""
AVID_WAS_RUNNING=false

log() { printf '[AEBridge Installer] %s\n' "$*"; }
die() {
  printf '[AEBridge Installer] FATAL: %s\n' "$*" >&2
  finish_progress
  if [[ "$NONINTERACTIVE" != "1" ]]; then
    osascript -e "display dialog \"AEBridge could not be installed.

$1\" buttons {\"OK\"} default button \"OK\" with title \"AEBridge Installer\" with icon stop" >/dev/null 2>&1 || true
  fi
  exit 1
}

# ── Progress window ───────────────────────────────────────────────────────
start_progress() {
  [[ "$NONINTERACTIVE" != "1" ]] || return 0
  [[ -f "$RESOURCES/install-progress.js" ]] || return 0
  PROGRESS_FILE="$(mktemp -t aebridge-install.XXXXXX)"
  printf '0|Preparing installation…\n' > "$PROGRESS_FILE"
  /usr/bin/osascript -l JavaScript "$RESOURCES/install-progress.js" \
    "$PROGRESS_FILE" >/dev/null 2>&1 &
  PROGRESS_PID=$!
}

set_progress() {
  [[ -n "$PROGRESS_FILE" ]] || { log "$2"; return 0; }
  printf '%s|%s\n' "$1" "$2" > "$PROGRESS_FILE"
}

finish_progress() {
  [[ -n "$PROGRESS_FILE" ]] || return 0
  printf '100|Installation complete\n' > "$PROGRESS_FILE"
  sleep 0.7
  printf 'DONE\n' > "$PROGRESS_FILE"
  [[ -n "$PROGRESS_PID" ]] && { wait "$PROGRESS_PID" 2>/dev/null || true; }
  rm -f "$PROGRESS_FILE"
  PROGRESS_FILE=""
  PROGRESS_PID=""
}

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

physical_arch() {
  if [[ "$(sysctl -in hw.optional.arm64 2>/dev/null || true)" == "1" ]]; then
    printf 'arm64\n'
  else
    case "$(uname -m)" in
      arm64|aarch64) printf 'arm64\n' ;;
      x86_64) printf 'x86_64\n' ;;
      *) return 1 ;;
    esac
  fi
}

validate_helper_bundle() {
  local app="$1" expected_arch="$2" actual_arches team
  local binary="$app/Contents/MacOS/aebridge-helper"
  [[ -x "$binary" ]] || { log "helper executable is missing"; return 1; }
  actual_arches="$(lipo -archs "$binary" 2>/dev/null || true)"
  printf '%s\n' "$actual_arches" | tr ' ' '\n' | grep -qx "$expected_arch" || {
    log "helper architecture '$actual_arches' does not include $expected_arch"
    return 1
  }
  if [[ "$ALLOW_ADHOC" != "1" ]]; then
    codesign --verify --deep --strict "$app" >/dev/null 2>&1 || {
      log "helper code signature is invalid"
      return 1
    }
    if [[ -n "$TEAM_ID" ]]; then
      team="$(codesign -dv --verbose=4 "$app" 2>&1 | awk -F= '/^TeamIdentifier=/{print $2; exit}')"
      [[ "$team" == "$TEAM_ID" ]] || {
        log "helper Team ID '${team:-none}' does not match $TEAM_ID"
        return 1
      }
    fi
  fi
}

validate_panel_avpi() {
  local avpi="$1" manifest comment
  unzip -tqq "$avpi" >/dev/null 2>&1 || die "the bundled Avid panel is not a valid AVPI package"
  manifest="$(unzip -p "$avpi" avid-manifest.json 2>/dev/null)"
  [[ "$manifest" == *'"name": "com.acohenvfx.aebridge"'* \
    && "$manifest" == *'"displayName": "AEBridge"'* \
    && "$manifest" == *'"displayText": "AEBridge"'* \
    && "$manifest" == *'"windowTitle": "AEBridge"'* \
    && "$manifest" == *'"url": "http://localhost:8010/app"'* ]] \
    || die "the bundled Avid panel has the wrong identity or startup URL"
  comment="$(unzip -z "$avpi" 2>/dev/null)"
  [[ "$comment" == *'<ds:Signature '* \
    && "$comment" == *'<ds:X509Certificate>'* ]] \
    || die "the bundled Avid panel is not digitally signed by Avid"
}

# Media Composer discovers Panel SDK plug-ins only during a true application
# launch. Closing a project or its windows is not enough, which led artists to
# reboot the Mac when the newly installed panel did not appear. Require a
# normal user-driven quit, then verify the process is actually gone before
# replacing the AVPI. We deliberately do not send Avid an AppleEvent to quit:
# that would add a confusing macOS Automation permission prompt.
avid_pids() {
  pgrep -f '/AvidMediaComposer\.app/Contents/MacOS/AvidMediaComposer' 2>/dev/null || true
}

prepare_avid_for_panel_install() {
  [[ "$NONINTERACTIVE" != "1" && "$SKIP_AVID_LIFECYCLE" != "1" ]] || return 0
  [[ -n "$(avid_pids)" ]] || return 0

  AVID_WAS_RUNNING=true
  local choice
  while [[ -n "$(avid_pids)" ]]; do
    choice="$(osascript 2>/dev/null <<'APPLESCRIPT' || true
  set dlg to display dialog "Avid Media Composer is currently open.

Before continuing:
1. Switch to Avid and save your work.
2. Choose Avid Media Composer > Quit Avid Media Composer, or press Command-Q.
3. Return here and click Continue.

Closing only the project or its windows is not enough. You do not need to restart your Mac." buttons {"Cancel", "Continue"} default button "Continue" with title "AEBridge Installer"
  return button returned of dlg
APPLESCRIPT
)"
    [[ "$choice" == "Continue" ]] || exit 0
    if [[ -n "$(avid_pids)" ]]; then
      osascript -e 'display alert "Avid is still running" message "Fully quit Media Composer with Command-Q, then click Continue again. A Mac restart is not required." as warning' >/dev/null 2>&1 || true
    fi
  done
}

offer_to_open_avid() {
  [[ "$NONINTERACTIVE" != "1" && "$SKIP_AVID_LIFECYCLE" != "1" ]] || return 0
  [[ -d "$AVID_APP_PATH" ]] || return 0

  local choice message
  if $AVID_WAS_RUNNING; then
    message="AEBridge is installed and Avid was fully closed. Open Media Composer now to load the new panel."
  else
    message="AEBridge is installed. Open Media Composer now to load the new panel."
  fi
  choice="$(osascript - "$message" 2>/dev/null <<'APPLESCRIPT' || true
on run argv
  set dlg to display dialog (item 1 of argv) buttons {"Done", "Open Avid"} default button "Open Avid" with title "AEBridge Installer"
  return button returned of dlg
end run
APPLESCRIPT
)"
  [[ "$choice" == "Open Avid" ]] && open "$AVID_APP_PATH" >/dev/null 2>&1 || true
}

# Offer to eject and bin the disk image once the install has succeeded, so the
# artist is not left with a mounted volume and a stale .dmg in Downloads.
offer_dmg_cleanup() {
  [[ "$NONINTERACTIVE" != "1" ]] || return 0

  local app_bundle mount_point dmg_path choice
  app_bundle="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  mount_point="$(df -P "$app_bundle" | awk 'NR == 2 { $1 = $2 = $3 = $4 = $5 = ""; sub(/^ +/, ""); print }')"
  [[ "$mount_point" == /Volumes/* ]] || return 0

  dmg_path="$(hdiutil info 2>/dev/null | awk -v mount="$mount_point" '
    /image-path[[:space:]]*:/ {
      path = $0
      sub(/^[^:]*:[[:space:]]*/, "", path)
      next
    }
    /^[[:space:]]*\/dev\// && index($0, mount) {
      print path
      exit
    }
  ')"
  [[ -f "$dmg_path" ]] || return 0

  choice="$(osascript 2>/dev/null <<'APPLESCRIPT'
  set dlg to display dialog "AEBridge is installed.

Would you like to keep this disk image, or eject it and move the .dmg file to Trash?" buttons {"Keep DMG", "Move to Trash"} default button "Keep DMG" with title "AEBridge Installer"
  return button returned of dlg
APPLESCRIPT
  )"
  [[ "$choice" == "Move to Trash" ]] || return 0

  # The installer itself runs from the mounted image. Let this process exit
  # before detaching the volume, then send the original disk image to Trash.
  (
    sleep 2
    hdiutil detach "$mount_point" >/dev/null 2>&1 || \
      hdiutil detach -force "$mount_point" >/dev/null 2>&1 || true
    if [[ -f "$dmg_path" ]]; then
      osascript - "$dmg_path" <<'APPLESCRIPT'
on run argv
  tell application "Finder"
    delete POSIX file (item 1 of argv)
  end tell
end run
APPLESCRIPT
    fi
  ) >/dev/null 2>&1 &
}

[[ -n "$RESOURCES" && -d "$RESOURCES" ]] || die "installer resources not found"

# ── Welcome ───────────────────────────────────────────────────────────────
if [[ "$NONINTERACTIVE" != "1" ]]; then
  result=$(osascript 2>/dev/null <<APPLESCRIPT
  set dlg to display dialog "Welcome to AEBridge

This installer will:
  • Install the panel plugin for Avid Media Composer
  • Set up the background helper service (port $HELPER_PORT)

You will be asked for your administrator password once, to install the panel.

Click Install to continue." buttons {"Quit", "Install"} default button "Install" with title "AEBridge Installer"
  return button returned of dlg
APPLESCRIPT
  )
  [[ "$result" == "Quit" ]] && exit 0
fi

prepare_avid_for_panel_install
start_progress

# ── 1. Stop anything already running ─────────────────────────────────────
# Unload before replacing files: launchd would otherwise keep the old helper
# alive holding the port, and the new one would fail to bind.
set_progress 8 "Stopping any running helper…"
if [[ "$SKIP_LAUNCHCTL" != "1" ]]; then
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
fi

# ── 2. Avid panel ────────────────────────────────────────────────────────
# /Library is not user-writable, so this is the one step needing admin. Ask
# once, via a single osascript call, rather than escalating the whole installer.
set_progress 18 "Installing the Avid panel…"
AVPI_SRC="$(find "$RESOURCES/avpi" -maxdepth 1 -name '*.avpi' 2>/dev/null | head -1)"
if [[ "$SKIP_AVPI" == "1" ]]; then
  log "skipping panel install (AEBRIDGE_INSTALL_SKIP_AVPI=1)"
elif [[ -n "$AVPI_SRC" ]]; then
  validate_panel_avpi "$AVPI_SRC"
  AVPI_NAME="$(basename "$AVPI_SRC")"
  log "installing panel -> $AVID_DIR/$AVPI_NAME"

  # Remove AEBridge panels left by earlier DMGs. They share this one's bundle
  # id and UI item id, so leaving them behind lists AEBridge twice in Avid's
  # Tools menu — observed 2026-08-06 with a v0.0.1 panel beside its renamed
  # copy. Other vendors' panels in the same folder are never touched.
  STALE=()
  while IFS= read -r f; do
    [[ -n "$f" && "$(basename "$f")" != "$AVPI_NAME" ]] && STALE+=("$f")
  done < <(find "$AVID_DIR" -maxdepth 1 \( -iname 'AE_Bridge*.avpi' -o -iname 'AEBridge*.avpi' \) 2>/dev/null)

  if [[ -w "$AVID_DIR" ]] || [[ ! -e "$AVID_DIR" && -w "$(dirname "$AVID_DIR")" ]]; then
    mkdir -p "$AVID_DIR"
    (( ${#STALE[@]} )) && rm -f "${STALE[@]}"
    cp "$AVPI_SRC" "$AVID_DIR/$AVPI_NAME"
    strip_quarantine "$AVID_DIR/$AVPI_NAME"
  else
    RM_CMD=""
    for f in ${STALE[@]+"${STALE[@]}"}; do RM_CMD+="rm -f '$f' && "; done
    osascript -e "do shell script \"mkdir -p '$AVID_DIR' && ${RM_CMD}cp '$AVPI_SRC' '$AVID_DIR/$AVPI_NAME' && (xattr -d com.apple.quarantine '$AVID_DIR/$AVPI_NAME' 2>/dev/null || true)\" with administrator privileges" \
      || die "panel install was cancelled or failed"
  fi
else
  die "the bundled Avid panel is missing from this installer"
fi

# ── 3. Seed helper app ───────────────────────────────────────────────────
# Shipping a helper in the DMG means first launch works without waiting on a
# download — an edit bay may have no internet at all.
set_progress 38 "Installing the AEBridge helper…"
SEED_ARCH="$(physical_arch)" || die "this Mac's processor architecture is unsupported"
SEED_APP="$RESOURCES/helper/$SEED_ARCH/AEBridgeHelper.app"
# Development DMGs created before RC1 carried one helper at this legacy path.
[[ -d "$SEED_APP" ]] || SEED_APP="$RESOURCES/helper/AEBridgeHelper.app"
if [[ -d "$SEED_APP" ]]; then
  # Refuse a seed the launcher would later reject anyway. An unsigned helper
  # installs fine and then fails the Team ID check on every update, which is a
  # far more confusing failure than one here.
  validate_helper_bundle "$SEED_APP" "$SEED_ARCH" || die "the bundled $SEED_ARCH helper failed architecture or signature validation"

  log "installing helper -> $APP_PATH"
  mkdir -p "$APP_DIR"
  rm -rf "$APP_PATH.old"
  [[ -d "$APP_PATH" ]] && mv "$APP_PATH" "$APP_PATH.old"
  # A tar pipe rather than cp -R: it does not carry the DMG's quarantine
  # metadata across into the installed copy.
  mkdir -p "$APP_PATH"
  if ! ( tar -cf - -C "$SEED_APP" . | tar -xf - -C "$APP_PATH" ); then
    rm -rf "$APP_PATH"
    [[ -d "$APP_PATH.old" ]] && mv "$APP_PATH.old" "$APP_PATH"
    die "could not install the helper app"
  fi
  strip_quarantine "$APP_PATH"
  if ! validate_helper_bundle "$APP_PATH" "$SEED_ARCH"; then
    rm -rf "$APP_PATH"
    [[ -d "$APP_PATH.old" ]] && mv "$APP_PATH.old" "$APP_PATH"
    die "the installed helper failed post-copy architecture or signature validation"
  fi
  rm -rf "$APP_PATH.old"
else
  die "the DMG does not contain a helper for $SEED_ARCH"
fi

# ── 4. Launcher ──────────────────────────────────────────────────────────
set_progress 52 "Installing the launcher…"
[[ -f "$RESOURCES/AEBridgeLauncher.sh" ]] || die "launcher missing from the DMG"
log "installing launcher -> $LAUNCHER_PATH"
mkdir -p "$SUPPORT_DIR" "$LOG_DIR"
cp "$RESOURCES/AEBridgeLauncher.sh" "$LAUNCHER_PATH"
chmod +x "$LAUNCHER_PATH"
strip_quarantine "$LAUNCHER_PATH"

# ── 5. launchd job ───────────────────────────────────────────────────────
set_progress 64 "Registering the background service…"
TEMPLATE="$RESOURCES/$LABEL.plist.template"
[[ -f "$TEMPLATE" ]] || die "launchd template missing from the DMG"
log "installing launchd job -> $PLIST_PATH"
mkdir -p "$AGENTS_DIR"
# The template's placeholders are absolute paths that only exist post-install.
sed -e "s|__LAUNCHER_PATH__|$LAUNCHER_PATH|g" \
    -e "s|__LOG_DIR__|$LOG_DIR|g" \
    "$TEMPLATE" > "$PLIST_PATH"
plutil -lint "$PLIST_PATH" >/dev/null || die "generated launchd plist is invalid"

# ── 6. Free the port, then start ─────────────────────────────────────────
if [[ "$SKIP_LAUNCHCTL" != "1" ]]; then
  # The launcher exits cleanly when something already holds the port ("helper
  # already running; nothing to do"), so a leftover process silently prevents
  # the freshly installed helper from ever running — the install then LOOKS
  # successful while the old build keeps serving. Observed 2026-08-06 against a
  # dev helper. Stop it first, the way DE's installer does.
  set_progress 74 "Starting the helper service…"
  OLD_PID="$(lsof -ti "tcp:$HELPER_PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$OLD_PID" ]]; then
    log "stopping the process already on port $HELPER_PORT (pid $OLD_PID)"
    kill $OLD_PID 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 $OLD_PID 2>/dev/null || break
      sleep 0.1
    done
    kill -0 $OLD_PID 2>/dev/null && kill -9 $OLD_PID 2>/dev/null || true
  fi

  launchctl load "$PLIST_PATH" || die "could not load the launchd job"
  launchctl kickstart -kp "gui/$(id -u)/$LABEL" 2>/dev/null || true

  # ── 7. Health check ────────────────────────────────────────────────────
  set_progress 86 "Waiting for the helper to become ready…"
  HELPER_OK=false
  DEADLINE=$((SECONDS + 45))
  while (( SECONDS < DEADLINE )); do
    if curl -sf --max-time 1 "http://127.0.0.1:$HELPER_PORT/healthz" >/dev/null 2>&1; then
      HELPER_OK=true
      break
    fi
    sleep 0.5
  done

  if $HELPER_OK; then
    log "helper is responding on 127.0.0.1:$HELPER_PORT"
    finish_progress
    offer_to_open_avid
    offer_dmg_cleanup
  else
    finish_progress
    TAIL_LOG=""
    [[ -f "$LOG_DIR/helper.err.log" ]] && TAIL_LOG="$(tail -8 "$LOG_DIR/helper.err.log" 2>/dev/null || true)"
    if [[ "$NONINTERACTIVE" == "1" ]]; then
      echo "FATAL: helper did not become healthy on port $HELPER_PORT." >&2
      echo "$TAIL_LOG" >&2
      exit 1
    fi
    echo "WARNING: helper did not respond within 45s." >&2
    echo "$TAIL_LOG" >&2
    osascript >/dev/null 2>&1 <<APPLESCRIPT || true
  display dialog "The panel was installed, but the helper has not answered yet.

It may still be starting. If AEBridge reports \"Helper offline\" in Avid, check:
$LOG_DIR/helper.err.log" buttons {"OK"} default button "OK" with title "AEBridge Installer"
APPLESCRIPT
  fi
else
  finish_progress
fi

log "done. Launch Media Composer, then open Tools > AEBridge. No Mac restart is required."
