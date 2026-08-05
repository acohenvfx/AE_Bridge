# -*- mode: python ; coding: utf-8 -*-
#
# PyInstaller spec for the AEBridge helper app.
#
# Build:  pyinstaller --noconfirm ota/aebridge-helper.spec   (from repo root)
# Output: dist/AEBridgeHelper.app
#
# Modelled on DifferenceEngine's ota/bmc-helper.spec, with three differences
# that matter:
#   1. The entry point is ota/aebridge_main.py, not service/app.py — AEBridge's
#      service is a package using relative imports (see that file).
#   2. pathex is the REPO root, so `import service.*` resolves as a package.
#   3. The panel UI (dist/html) is bundled, so the helper can serve it locally
#      when AEBRIDGE_UI_ORIGIN is unset or the hosted origin is unreachable.
import os

from PyInstaller.utils.hooks import collect_submodules

REPO = os.path.abspath(os.getcwd())

# --- hidden imports ---------------------------------------------------------
# Enumerate the service package explicitly. FastAPI routers are wired up by
# import side effect, so a router that is only referenced dynamically would
# otherwise be dropped and produce a helper that boots but 404s.
hiddenimports = [
    'service',
    'service.app',
    'service.config',
    'service.models',
    'service.jobs',
    'service.media',
    'service.edl',
    'service.edl_recovery',
    'service.watcher',
    'service.paths',
    'service.integrations',
    'service.integrations.ae',
    'service.routers',
    'service.routers.aebridge',
    'service.routers.ui',
    'service.routers.ui_proxy',
    'service.routers.version',
]

# Third-party deps that use dynamic import or C extensions. uvicorn in
# particular loads its loop/protocol/lifespan implementations by name at
# runtime, so a static analysis pass alone misses them.
for pkg in ('uvicorn', 'httpx', 'httpcore', 'fastapi', 'starlette', 'pydantic'):
    try:
        hiddenimports += collect_submodules(pkg, on_error='ignore')
    except Exception:
        pass
hiddenimports += [
    'h11', 'anyio', 'sniffio', 'certifi', 'idna',
    'pydantic_core', 'annotated_types',
]

# --- data + binaries --------------------------------------------------------
# The generated panel UI. `yarn generate:release` must have run first; the
# build script enforces that rather than shipping a helper that 404s at /app.
datas = []
_dist_html = os.path.join(REPO, 'dist', 'html')
if os.path.isdir(_dist_html):
    datas += [(_dist_html, os.path.join('dist', 'html'))]

# The native AVFoundation probe backs return validation (service/media.py).
# Without SOME probe every import fails, because a probe error is reported as a
# failed validation — and an artist machine will not have ffprobe.
#
# This replaces bundling ffprobe: FFmpeg's readily available macOS builds are
# GPL and dynamically linked (a Homebrew ffprobe breaks anywhere without
# /opt/homebrew), so shipping one carried both a licensing obligation and a
# portability problem. The native probe is universal2, a few hundred KB, and
# signs with the rest of the bundle. Verified frame-for-frame against ffprobe
# across every plate and render on disk.
binaries = []
_probe = os.path.join(REPO, 'dist', 'native', 'aebridge-probe')
if os.path.isfile(_probe):
    binaries += [(_probe, '.')]

# Optional escape hatch: embed an ffprobe too, if a redistributable STATIC
# build is ever wanted as a fallback. Not required.
_ffprobe = os.environ.get('AEBRIDGE_FFPROBE_BIN', '').strip()
if _ffprobe and os.path.isfile(_ffprobe):
    binaries += [(_ffprobe, '.')]

block_cipher = None

a = Analysis(
    [os.path.join(REPO, 'ota', 'aebridge_main.py')],
    pathex=[REPO],
    binaries=binaries,
    datas=datas,
    hiddenimports=sorted(set(hiddenimports)),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'PySide6', 'PyQt5', 'pandas', 'numpy', 'matplotlib', 'scipy',
        'pip', 'setuptools', 'wheel', 'pytest',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='aebridge-helper',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='aebridge-helper',
)

# A real .app bundle rather than a bare executable: it gives the helper a
# stable signed identity for Gatekeeper and notarization, and a stable target
# for the launchd job.
_ver = os.environ.get('AEBRIDGE_RUNTIME_VERSION', '0.0.0')
app = BUNDLE(
    coll,
    name='AEBridgeHelper.app',
    icon=None,
    bundle_identifier='com.acohenvfx.aebridge.helper',
    version=_ver,
    info_plist={
        'CFBundleName': 'AEBridge Helper',
        'CFBundleDisplayName': 'AEBridge Helper',
        'CFBundleIdentifier': 'com.acohenvfx.aebridge.helper',
        'CFBundleExecutable': 'aebridge-helper',
        'CFBundleShortVersionString': _ver,
        'CFBundleVersion': _ver,
        'CFBundlePackageType': 'APPL',
        # Faceless background service: no Dock icon, no menu bar. The helper
        # has no UI of its own — the panel is its interface.
        'LSBackgroundOnly': False,
        'LSUIElement': True,
        'LSMinimumSystemVersion': '13.0',
        'NSHighResolutionCapable': True,
    },
)
