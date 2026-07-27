"""macOS native dialogs via AppleScript (osascript).

The helper runs in the user's GUI session, so it can present a real file
picker. Returns None on cancel.
"""
from __future__ import annotations

import subprocess
import sys
from typing import Optional

_CHOOSE_AEP = (
    'try\n'
    '  set f to choose file with prompt "Choose an After Effects project" '
    'of type {"aep", "com.adobe.aftereffects.project"}\n'
    '  POSIX path of f\n'
    'on error number -128\n'  # user cancelled
    '  return "__CANCELLED__"\n'
    'end try'
)


def choose_aep() -> Optional[str]:
    """Open a native 'choose .aep file' dialog. None if unavailable or cancelled."""
    if sys.platform != "darwin":
        return None
    try:
        out = subprocess.run(
            ["osascript", "-e", _CHOOSE_AEP],
            capture_output=True, text=True, timeout=300,
        )
    except Exception:
        return None
    path = (out.stdout or "").strip()
    if not path or path == "__CANCELLED__":
        return None
    return path


def _save_script(default_name: str) -> str:
    safe = (default_name or "AEBridge").replace('"', "'")
    return (
        "try\n"
        f'  set f to choose file name with prompt "Name the new After Effects project" '
        f'default name "{safe}.aep"\n'
        "  POSIX path of f\n"
        "on error number -128\n"
        '  return "__CANCELLED__"\n'
        "end try"
    )


def choose_save_aep(default_name: str = "AEBridge") -> Optional[str]:
    """Open a native 'save as .aep' dialog (name + location). None if cancelled."""
    if sys.platform != "darwin":
        return None
    try:
        out = subprocess.run(
            ["osascript", "-e", _save_script(default_name)],
            capture_output=True, text=True, timeout=300,
        )
    except Exception:
        return None
    path = (out.stdout or "").strip()
    if not path or path == "__CANCELLED__":
        return None
    return path
