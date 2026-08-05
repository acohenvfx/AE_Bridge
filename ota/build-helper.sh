#!/usr/bin/env bash
#
# build-helper.sh — build the AEBridge helper into a standalone macOS app.
#
# Output: dist/AEBridgeHelper.app
#
# Modelled on DifferenceEngine's ota/build-helper.sh. AEBridge's payload is far
# smaller (no native engine, no ML model) — it is a FastAPI service plus the
# generated panel UI.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== Building AEBridge helper ==="

# Prefer 3.12: most mature wheels for the helper's deps, and matches the
# Python the project is developed against.
PYTHON=""
for candidate in python3.12 python3.11 python3.13 python3; do
  if command -v "$candidate" >/dev/null 2>&1; then
    PYTHON="$candidate"
    break
  fi
done
if [[ -z "$PYTHON" ]]; then
  for ver in 3.12 3.11 3.13; do
    fw="/Library/Frameworks/Python.framework/Versions/$ver/bin/python$ver"
    if [[ -x "$fw" ]]; then PYTHON="$fw"; break; fi
  done
fi
if [[ -z "$PYTHON" ]]; then
  echo "FATAL: Python 3.11+ is required to build the helper." >&2
  exit 1
fi
echo "Using Python: $PYTHON ($($PYTHON --version 2>&1))"

if [[ -z "${AEBRIDGE_RUNTIME_VERSION:-}" ]]; then
  AEBRIDGE_RUNTIME_VERSION="$("$PYTHON" -c \
    'import json; print(json.load(open("package.json", encoding="utf-8"))["version"])')"
fi
export AEBRIDGE_RUNTIME_VERSION
echo "Helper runtime version: $AEBRIDGE_RUNTIME_VERSION"

# The panel UI is bundled INTO the app so a fresh install works offline and
# before any hosted deploy. Refuse to build without it rather than shipping a
# helper whose /app 404s.
if [[ ! -f dist/html/app/index.html ]]; then
  echo "Building panel UI (yarn generate:release)..."
  if ! command -v yarn >/dev/null 2>&1; then
    echo "FATAL: dist/html/app/index.html is missing and yarn is unavailable." >&2
    echo "       Run 'yarn generate:release' first." >&2
    exit 1
  fi
  yarn generate:release
fi
[[ -f dist/html/app/index.html ]] || { echo "FATAL: panel UI build produced no dist/html/app/index.html" >&2; exit 1; }

# The native AVFoundation probe backs return validation. Without a probe every
# Import fails, and an artist machine will not have ffprobe — so this is built
# unconditionally and embedded, rather than depending on anything external.
echo "Building native probe..."
bash native/build-probe.sh dist/native
[[ -x dist/native/aebridge-probe ]] || { echo "FATAL: native probe was not built" >&2; exit 1; }
if ! lipo -info dist/native/aebridge-probe 2>/dev/null | grep -q 'x86_64 arm64\|arm64 x86_64'; then
  echo "WARNING: probe is not universal — the release build must cover both arches." >&2
fi

# Optional: embed an ffprobe as well. Only accept a portable one; a Homebrew
# build is dylib-linked and would break on any machine without /opt/homebrew.
if [[ -n "${AEBRIDGE_FFPROBE_BIN:-}" ]]; then
  [[ -f "$AEBRIDGE_FFPROBE_BIN" ]] || { echo "FATAL: AEBRIDGE_FFPROBE_BIN does not exist" >&2; exit 1; }
  if otool -L "$AEBRIDGE_FFPROBE_BIN" 2>/dev/null | grep -qE '/opt/homebrew|/usr/local/Cellar'; then
    echo "FATAL: $AEBRIDGE_FFPROBE_BIN links against Homebrew dylibs and will not run" >&2
    echo "       on a machine without them. Use a static build." >&2
    exit 1
  fi
  echo "Also embedding ffprobe: $AEBRIDGE_FFPROBE_BIN"
  export AEBRIDGE_FFPROBE_BIN
fi

# Fresh, isolated build venv so the bundle cannot pick up stray site-packages.
VENV_DIR="$PROJECT_DIR/.helper-build-venv"
rm -rf "$VENV_DIR"
"$PYTHON" -m venv "$VENV_DIR"
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

echo "Installing dependencies..."
pip install --upgrade pip >/dev/null
pip install -r requirements.txt
pip install pyinstaller

echo "Running PyInstaller..."
# Not PyInstaller's default ./build work directory: this repo's panel build
# scripts live in build/. DE isolates its workpath under dist/ for the same
# reason.
rm -rf dist/pyi-work dist/AEBridgeHelper.app dist/aebridge-helper
python -m PyInstaller --clean --noconfirm \
  --workpath dist/pyi-work --distpath dist ota/aebridge-helper.spec

deactivate

APP="dist/AEBridgeHelper.app"
[[ -d "$APP" ]] || { echo "FATAL: $APP was not produced" >&2; exit 1; }

echo
echo "=== Built $APP ==="
echo "arch: $(lipo -info "$APP/Contents/MacOS/aebridge-helper" 2>/dev/null || echo unknown)"
echo "size: $(du -sh "$APP" | cut -f1)"
