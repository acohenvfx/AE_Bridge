#!/usr/bin/env bash
#
# AEBridgeLauncher.sh — stable entry point for the AEBridge helper.
#
# Installed by the DMG and started by the launchd job. It is the ONLY thing
# whose path is fixed: the helper app it launches is replaced in place by
# updates, so nothing else needs to know a version.
#
# Responsibilities, in order:
#   1. Check GitHub Releases for a newer helper.
#   2. Download the asset for this machine's architecture.
#   3. Verify SHA-256, then Developer ID Team ID.
#   4. Swap it into place atomically.
#   5. Exec it.
#
# Ported from DifferenceEngine's ota/DifferenceEngineLauncher.sh, minus the
# legacy-layout migrations that only its older releases need.
#
set -euo pipefail

AEBRIDGE_GH_REPO="${AEBRIDGE_GH_REPO:-acohenvfx/AE_Bridge_Releases}"
AEBRIDGE_HELPER_DIR="${AEBRIDGE_HELPER_DIR:-$HOME/Library/Application Support/AEBridge/helper}"
AEBRIDGE_HELPER_APP_PATH="${AEBRIDGE_HELPER_APP_PATH:-$HOME/Applications/AEBridge Helper.app}"
# Refuse a helper not signed by this team. Setting it to the EMPTY string
# disables the check, for local development builds only.
# Note the `-` rather than `:-`: with `:-` an explicitly empty value would fall
# back to the default, making the check impossible to turn off.
AEBRIDGE_REQUIRE_TEAM_ID="${AEBRIDGE_REQUIRE_TEAM_ID-RRD4N3SXSG}"
AEBRIDGE_SKIP_UPDATE="${AEBRIDGE_SKIP_UPDATE:-0}"
AEBRIDGE_UPDATE_TIMEOUT="${AEBRIDGE_UPDATE_TIMEOUT:-8}"

# Hosted-UI proxy (see service/routers/ui_proxy.py). Points at the direct
# workers.dev origin, confirmed live 2026-08-06 (serves the current
# Git-connected Workers Build, not a stale cache). Must NOT be the custom
# domain (aebridge.andrewcoheneditor.com) — that sits behind Cloudflare
# browser verification, which Avid's WebView cannot complete. Set to the
# empty string to fall back to the panel UI bundled inside the app (always
# works offline) — e.g. `AEBRIDGE_UI_ORIGIN= bash AEBridgeLauncher.sh`.
export AEBRIDGE_UI_ORIGIN="${AEBRIDGE_UI_ORIGIN-https://ae-bridge.andrewcohenvfx.workers.dev}"

# Overridable so the update path can be exercised against a local server, and
# so an internal mirror can be used without patching the launcher.
LATEST_BASE="${AEBRIDGE_RELEASE_BASE:-https://github.com/$AEBRIDGE_GH_REPO/releases/latest/download}"
APP_PATH="$AEBRIDGE_HELPER_APP_PATH"
APP_BIN="$APP_PATH/Contents/MacOS/aebridge-helper"
VERSION_FILE="$AEBRIDGE_HELPER_DIR/version.txt"

log() { printf '[AEBridgeLauncher] %s\n' "$*" >&2; }

machine_arch() {
  case "$(uname -m)" in
    arm64|aarch64) echo arm64 ;;
    x86_64) echo x86_64 ;;
    *) echo "" ;;
  esac
}

arch_asset() {
  local arch
  arch="$(machine_arch)"
  [[ -n "$arch" ]] && echo "AEBridgeHelper-$arch.tar.gz"
}

helper_installed() { [[ -x "$APP_BIN" ]]; }

strip_quarantine() {
  local target="$1"
  if [[ -d "$target" ]]; then
    find "$target" -exec xattr -d com.apple.quarantine {} + 2>/dev/null || true
  else
    xattr -d com.apple.quarantine "$target" 2>/dev/null || true
  fi
}

# Gatekeeper alone is not enough here: a downloaded archive is unpacked by this
# script, so nothing else checks who signed it. Refuse anything not signed by
# the expected team rather than executing it.
verify_codesign() {
  local target="$1"
  if ! command -v codesign >/dev/null 2>&1; then
    log "codesign unavailable; skipping signature check"
    return 0
  fi
  if ! codesign --verify --strict "$target" >/dev/null 2>&1; then
    if [[ -n "$AEBRIDGE_REQUIRE_TEAM_ID" ]]; then
      log "FATAL: helper failed codesign --verify and a Team ID is required"
      return 1
    fi
    log "warning: helper is not validly signed"
    return 0
  fi
  if [[ -n "$AEBRIDGE_REQUIRE_TEAM_ID" ]]; then
    local team
    team="$(codesign -dv --verbose=4 "$target" 2>&1 | sed -n 's/^TeamIdentifier=//p')"
    if [[ "$team" != "$AEBRIDGE_REQUIRE_TEAM_ID" ]]; then
      log "FATAL: helper Team ID '$team' != required '$AEBRIDGE_REQUIRE_TEAM_ID'"
      return 1
    fi
  fi
  return 0
}

# Unpack to a staging dir and swap only once verified, so an interrupted or
# tampered download can never leave a half-installed helper in place.
install_bundle() {
  local archive="$1"
  local staging="$AEBRIDGE_HELPER_DIR/.staging.$$"
  rm -rf "$staging"
  mkdir -p "$staging"
  if ! tar -xzf "$archive" -C "$staging"; then
    log "FATAL: could not unpack helper archive"
    rm -rf "$staging"
    return 1
  fi

  local unpacked
  unpacked="$(find "$staging" -maxdepth 2 -name 'AEBridgeHelper.app' -type d | head -1)"
  if [[ -z "$unpacked" ]]; then
    log "FATAL: archive did not contain AEBridgeHelper.app"
    rm -rf "$staging"
    return 1
  fi

  strip_quarantine "$unpacked"
  if ! verify_codesign "$unpacked"; then
    rm -rf "$staging"
    return 1
  fi

  mkdir -p "$(dirname "$APP_PATH")"
  rm -rf "$APP_PATH.old"
  [[ -d "$APP_PATH" ]] && mv "$APP_PATH" "$APP_PATH.old"
  if ! mv "$unpacked" "$APP_PATH"; then
    log "FATAL: could not move helper into place; restoring previous"
    [[ -d "$APP_PATH.old" ]] && mv "$APP_PATH.old" "$APP_PATH"
    rm -rf "$staging"
    return 1
  fi
  rm -rf "$APP_PATH.old" "$staging"
  return 0
}

update_helper() {
  local max_time="${1:-$AEBRIDGE_UPDATE_TIMEOUT}"
  local asset remote_version local_version tmp_archive expected actual http_code

  asset="$(arch_asset)"
  if [[ -z "$asset" ]]; then
    log "unsupported architecture: $(uname -m)"
    return 1
  fi

  remote_version="$(curl -fsSL --max-time "$max_time" "$LATEST_BASE/version.txt" 2>/dev/null || true)"
  remote_version="$(printf '%s' "$remote_version" | tr -d '[:space:]')"
  if [[ -z "$remote_version" ]]; then
    # Offline is normal in an edit bay. An installed helper still runs.
    if helper_installed; then
      log "could not reach GitHub Releases; using the installed helper"
      return 0
    fi
    log "could not reach GitHub Releases and no helper is installed"
    return 1
  fi

  # Guard the read: `2>/dev/null` silences tr, not a failed shell redirection,
  # so a first run would otherwise print a "No such file" error before doing
  # exactly the right thing.
  local_version=""
  [[ -f "$VERSION_FILE" ]] && local_version="$(tr -d '[:space:]' < "$VERSION_FILE" || true)"
  if helper_installed && [[ "$remote_version" == "$local_version" ]]; then
    log "helper up to date ($local_version)"
    return 0
  fi

  log "updating helper: '${local_version:-none}' -> '$remote_version'"
  mkdir -p "$AEBRIDGE_HELPER_DIR"
  tmp_archive="$(mktemp "$AEBRIDGE_HELPER_DIR/.aebridge-helper.XXXXXX")"
  # shellcheck disable=SC2064
  trap "rm -f '$tmp_archive'" RETURN

  http_code="$(curl -sSL -o "$tmp_archive" -w '%{http_code}' --max-time 120 "$LATEST_BASE/$asset" || true)"
  if [[ "$http_code" != "200" ]]; then
    log "download failed for $asset (HTTP ${http_code:-error})"
    helper_installed && { log "keeping the installed helper"; return 0; }
    return 1
  fi

  # Checksum before signature: a truncated download would otherwise surface as
  # a confusing signature failure.
  expected="$(curl -fsSL --max-time "$max_time" "$LATEST_BASE/$asset.sha256" 2>/dev/null | awk '{print $1}' || true)"
  if [[ -n "$expected" ]]; then
    actual="$(shasum -a 256 "$tmp_archive" | awk '{print $1}')"
    if [[ "$expected" != "$actual" ]]; then
      log "FATAL: checksum mismatch for $asset"
      log "  expected $expected"
      log "  actual   $actual"
      return 1
    fi
  else
    log "warning: no published checksum for $asset"
  fi

  install_bundle "$tmp_archive" || return 1
  printf '%s\n' "$remote_version" > "$VERSION_FILE"
  log "helper updated to $remote_version"
  return 0
}

main() {
  if [[ "$AEBRIDGE_SKIP_UPDATE" != "1" ]]; then
    update_helper || {
      helper_installed || { log "no usable helper; aborting"; exit 1; }
      log "update failed; starting the installed helper"
    }
  fi

  helper_installed || { log "FATAL: no helper at $APP_BIN"; exit 1; }

  # Another instance already owns the port — starting a second would fail to
  # bind and look like a crash.
  if lsof -nP -iTCP:8010 -sTCP:LISTEN >/dev/null 2>&1; then
    log "helper already running on 8010; nothing to do"
    exit 0
  fi

  log "starting $APP_BIN"
  exec "$APP_BIN"
}

main "$@"
