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

log() { printf '[AEBridgeLauncher] %s\n' "$*" >&2; }

# The installed product is local-first: use the signed helper's bundled UI
# unless the artist explicitly selects the Cloudflare test channel. This keeps
# an outage, stale web deploy, or WebView/network-policy change from breaking
# an otherwise healthy Avid panel. An explicit AEBRIDGE_UI_ORIGIN remains a
# developer override. The small channel file makes switching persistent and
# reversible without rebuilding the installer.
AEBRIDGE_UI_CHANNEL_FILE="${AEBRIDGE_UI_CHANNEL_FILE:-$AEBRIDGE_HELPER_DIR/ui-channel}"
AEBRIDGE_HOSTED_UI_ORIGIN="https://ae-bridge.andrewcohenvfx.workers.dev"
if [[ "${AEBRIDGE_UI_ORIGIN+x}" != "x" ]]; then
  ui_channel=""
  [[ -f "$AEBRIDGE_UI_CHANNEL_FILE" ]] && ui_channel="$(tr -d '[:space:]' < "$AEBRIDGE_UI_CHANNEL_FILE" || true)"
  case "$ui_channel" in
    cloudflare) AEBRIDGE_UI_ORIGIN="$AEBRIDGE_HOSTED_UI_ORIGIN" ;;
    ""|bundled) AEBRIDGE_UI_ORIGIN="" ;;
    *)
      log "unknown UI channel '$ui_channel'; using bundled UI"
      AEBRIDGE_UI_ORIGIN=""
      ;;
  esac
fi
export AEBRIDGE_UI_ORIGIN

# Overridable so the update path can be exercised against a local server, and
# so an internal mirror can be used without patching the launcher.
LATEST_BASE="${AEBRIDGE_RELEASE_BASE:-https://github.com/$AEBRIDGE_GH_REPO/releases/download/helper-latest}"
APP_PATH="$AEBRIDGE_HELPER_APP_PATH"
APP_BIN="$APP_PATH/Contents/MacOS/aebridge-helper"
VERSION_FILE="$AEBRIDGE_HELPER_DIR/version.txt"

normalize_local_version() {
  local version="${1:-}"
  # v0.0.3/v0.0.4 wrote the immutable Git tag into the local state file.
  # Accept that one legacy shape long enough to migrate it to the numeric
  # runtime version. Remote metadata remains strict so CI cannot repeat the
  # publishing defect unnoticed.
  version="${version#helper-v}"
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || return 1
  printf '%s\n' "$version"
}

semver_lt() {
  local lhs="$1" rhs="$2"
  local l_major l_minor l_patch r_major r_minor r_patch
  IFS=. read -r l_major l_minor l_patch <<< "$lhs"
  IFS=. read -r r_major r_minor r_patch <<< "$rhs"
  (( l_major < r_major || (l_major == r_major && l_minor < r_minor) ||
     (l_major == r_major && l_minor == r_minor && l_patch < r_patch) ))
}

machine_arch() {
  # LaunchServices may start a universal app under Rosetta. uname then reports
  # x86_64 even though the physical machine can run the arm64 helper.
  if [[ "$(sysctl -in hw.optional.arm64 2>/dev/null || true)" == "1" ]]; then
    echo arm64
    return
  fi
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
    if [[ -n "$AEBRIDGE_REQUIRE_TEAM_ID" ]]; then
      log "FATAL: codesign is unavailable and a Team ID is required"
      return 1
    fi
    log "warning: codesign unavailable; signature check disabled"
    return 0
  fi
  if ! codesign --verify --deep --strict "$target" >/dev/null 2>&1; then
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
  local member
  while IFS= read -r member; do
    member="${member#./}"
    case "$member" in
      /*|../*|*/../*|*/..|..)
        log "FATAL: unsafe path in helper archive: $member"
        rm -rf "$staging"
        return 1
        ;;
    esac
  done < <(tar -tzf "$archive")
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
  local asset remote_version local_version local_version_raw tmp_archive expected actual http_code

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
  local_version_raw=""
  [[ -f "$VERSION_FILE" ]] && local_version_raw="$(tr -d '[:space:]' < "$VERSION_FILE" || true)"
  local_version="$(normalize_local_version "$local_version_raw" 2>/dev/null || true)"
  if ! [[ "$remote_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    log "FATAL: invalid helper version: $remote_version"
    return 1
  fi
  if [[ -n "$local_version" && "$local_version_raw" != "$local_version" ]]; then
    mkdir -p "$AEBRIDGE_HELPER_DIR"
    printf '%s\n' "$local_version" > "$VERSION_FILE"
    log "migrated helper version record: $local_version_raw -> $local_version"
  fi
  if helper_installed && [[ "$local_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    if [[ "$remote_version" == "$local_version" ]]; then
      log "helper up to date ($local_version)"
      return 0
    fi
    if semver_lt "$remote_version" "$local_version"; then
      log "remote helper $remote_version is older than installed $local_version; refusing downgrade"
      return 0
    fi
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
  if ! [[ "$expected" =~ ^[[:xdigit:]]{64}$ ]]; then
    log "FATAL: no valid published checksum for $asset"
    return 1
  fi
  actual="$(shasum -a 256 "$tmp_archive" | awk '{print $1}')"
  if [[ "$expected" != "$actual" ]]; then
    log "FATAL: checksum mismatch for $asset"
    log "  expected $expected"
    log "  actual   $actual"
    return 1
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

  # Keep /v1/version aligned with the installed bundle and OTA record.
  if [[ -z "${AEBRIDGE_RUNTIME_VERSION:-}" ]]; then
    if [[ -f "$VERSION_FILE" ]]; then
      AEBRIDGE_RUNTIME_VERSION="$(normalize_local_version "$(tr -d '[:space:]' < "$VERSION_FILE" || true)" 2>/dev/null || true)"
    elif command -v /usr/libexec/PlistBuddy >/dev/null 2>&1; then
      AEBRIDGE_RUNTIME_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP_PATH/Contents/Info.plist" 2>/dev/null || true)"
    fi
  fi
  export AEBRIDGE_RUNTIME_VERSION

  # Another instance already owns the port — starting a second would fail to
  # bind and look like a crash.
  if lsof -nP -iTCP:8010 -sTCP:LISTEN >/dev/null 2>&1; then
    log "helper already running on 8010; nothing to do"
    exit 0
  fi

  log "starting $APP_BIN"
  exec "$APP_BIN"
}

if [[ "${AEBRIDGE_LAUNCHER_LIBRARY_ONLY:-0}" != "1" ]]; then
  main "$@"
fi
