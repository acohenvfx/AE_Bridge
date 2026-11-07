#!/usr/bin/env bash
# Build both helper architectures from the current local source without
# publishing an OTA release or replacing signed AVPIs/helper seeds.
# Output is ad-hoc signed by PyInstaller, not distribution-signed/notarized.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
BUILD_PYTHON="${AEBRIDGE_BUILD_PYTHON:-/Library/Frameworks/Python.framework/Versions/3.12/bin/python3.12}"
[[ -x "$BUILD_PYTHON" ]] || {
  echo "FATAL: install universal Python 3.12 or set AEBRIDGE_BUILD_PYTHON." >&2
  exit 1
}
VERSION="$("$BUILD_PYTHON" -c 'import json; print(json.load(open("package.json"))["version"])')"
export AEBRIDGE_RUNTIME_VERSION="$VERSION"
BUILD_ROOT="$PROJECT_DIR/dist/local-helper-builds/$VERSION"
mkdir -p "$BUILD_ROOT"

# Check both runtimes before starting the longer dependency/build steps.
for target in arm64 x86_64; do
  actual="$(arch -"$target" "$BUILD_PYTHON" -c 'import platform; print(platform.machine())')"
  [[ "$actual" == "$target" ]] || {
    echo "FATAL: Python must run natively as $target (found $actual)." >&2
    exit 1
  }
done

# Generate only the UI: build:panel would regenerate the certified AVPI.
yarn generate:release
export CLANG_MODULE_CACHE_PATH="$BUILD_ROOT/module-cache"
export SWIFT_MODULECACHE_PATH="$CLANG_MODULE_CACHE_PATH"
mkdir -p "$CLANG_MODULE_CACHE_PATH"
bash native/build-probe.sh dist/native
for target in arm64 x86_64; do
  lipo -archs dist/native/aebridge-probe | tr ' ' '\n' | grep -qx "$target" || {
    echo "FATAL: native probe is missing $target." >&2
    exit 1
  }
done

for target in arm64 x86_64; do
  target_dir="$BUILD_ROOT/$target"
  mkdir -p "$target_dir"
  arch -"$target" "$BUILD_PYTHON" -m venv "$target_dir/venv"
  target_python="$target_dir/venv/bin/python"
  echo "Installing locked dependencies for $target..."
  arch -"$target" "$target_python" -m pip install \
    --cache-dir "$BUILD_ROOT/pip-cache" -r requirements-lock.txt
  echo "Building helper $VERSION for $target..."
  PYINSTALLER_CONFIG_DIR="$target_dir/pyinstaller-cache" \
    arch -"$target" "$target_python" -m PyInstaller --clean --noconfirm \
      --workpath "$target_dir/work" --distpath "$target_dir" \
      ota/aebridge-helper.spec
  app="$target_dir/AEBridgeHelper.app"
  actual="$(lipo -archs "$app/Contents/MacOS/aebridge-helper")"
  [[ "$actual" == "$target" ]] || { echo "FATAL: wrong helper architecture: $actual" >&2; exit 1; }
  actual_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Contents/Info.plist")"
  [[ "$actual_version" == "$VERSION" ]] || { echo "FATAL: wrong helper version: $actual_version" >&2; exit 1; }
  codesign --verify --deep --strict "$app"
done

echo "Built both helpers at $BUILD_ROOT/{arm64,x86_64}/AEBridgeHelper.app"
echo "Developer ID signing and notarization are still required before staging these for a release DMG."
