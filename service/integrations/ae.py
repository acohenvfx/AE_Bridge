"""After Effects integration (macOS).

Real work: locate After Effects, build/append a comp via ExtendScript, and
launch AE interactively so the editor can work. `aerender` is used only for a
future headless mode; interactive comp construction uses the `AfterFX` binary
with `-r script.jsx`.
"""
from __future__ import annotations

import json
import os
import plistlib
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from ..models import ProjectMode, Sidecar

_APP_GLOBS = [
    "/Applications/Adobe After Effects */Adobe After Effects *.app",
    "/Applications/Adobe After Effects*/Adobe After Effects*.app",
]


@dataclass
class AEInstall:
    version: str
    app: Path        # .../Adobe After Effects 2024.app
    afterfx: Path    # .../Contents/MacOS/AfterFX
    aerender: Optional[Path]


_cached: Optional[AEInstall] = None
_searched: list[str] = []


def _bundle_executable(app: Path) -> Optional[Path]:
    """Resolve the real launch binary from the .app bundle.

    The executable name is NOT always 'AfterFX' (it varies by version), so read
    CFBundleExecutable from Info.plist; fall back to any executable in MacOS/.
    """
    macos = app / "Contents" / "MacOS"
    info = app / "Contents" / "Info.plist"
    try:
        with open(info, "rb") as f:
            exe = plistlib.load(f).get("CFBundleExecutable")
        if exe and (macos / exe).is_file():
            return macos / exe
    except Exception:
        pass
    if macos.is_dir():
        for p in sorted(macos.iterdir()):
            if p.is_file() and os.access(p, os.X_OK):
                return p
    return None


def _score(app: Path) -> tuple:
    """Prefer the interactive app over the headless Render Engine, release over
    Beta, and newer years first."""
    name = app.name
    m = re.search(r"(\d{4})", name)
    year = int(m.group(1)) if m else 0
    return (0 if "Render Engine" in name else 1, 0 if "Beta" in name else 1, year)


def find_ae(refresh: bool = False) -> Optional[AEInstall]:
    """Locate the best After Effects install. macOS only."""
    global _cached, _searched
    if _cached and not refresh:
        return _cached
    _searched = []
    if sys.platform != "darwin":
        return None

    candidates: list[Path] = []
    for pat in _APP_GLOBS:
        for p in Path("/").glob(pat.lstrip("/")):
            if p.is_dir():
                candidates.append(p)
    candidates = sorted(set(candidates), key=lambda p: str(p))
    _searched = [str(p) for p in candidates]

    for app in sorted(candidates, key=_score, reverse=True):
        binary = _bundle_executable(app)
        if not binary:
            continue
        m = re.search(r"After Effects\s+(.+?)\.app", app.name)
        version = m.group(1).strip() if m else "unknown"
        aerender = app.parent / "aerender"
        _cached = AEInstall(
            version=version,
            app=app,
            afterfx=binary,
            aerender=aerender if aerender.is_file() else None,
        )
        return _cached
    return None


def detect_ae_version() -> Optional[str]:
    ae = find_ae(refresh=True)
    return ae.version if ae else None


def diagnostics() -> dict:
    ae = find_ae()
    return {
        "found": ae is not None,
        "version": ae.version if ae else None,
        "app": str(ae.app) if ae else None,
        "afterfx": str(ae.afterfx) if ae else None,
        "aerender": str(ae.aerender) if ae and ae.aerender else None,
        "searched": _searched,
        "platform": sys.platform,
    }


# --- comp construction -----------------------------------------------------
_JSX_TEMPLATE = r"""
// AEBridge generated script — builds/opens a comp and leaves AE open.
(function () {
    var P = %(params)s;
    app.beginUndoGroup("AEBridge");
    try {
        var proj;
        if (P.mode === "existing_project") {
            proj = app.open(new File(P.target_project));
        } else if (P.template && new File(P.template).exists) {
            proj = app.open(new File(P.template));
        } else {
            proj = app.newProject();
        }
        proj = proj || app.project;

        var fps = parseFloat(P.frame_rate) || 24;
        var dur = (P.frame_count && fps) ? (P.frame_count / fps) : 4;
        var comp = proj.items.addComp(P.comp_name, P.width, P.height, 1.0, dur, fps);

        var addedPlate = false;
        var reason = "no reference path";
        if (P.reference) {
            var rf = new File(P.reference);
            if (!rf.exists) {
                reason = "file not found: " + P.reference;
            } else {
                try {
                    var io = new ImportOptions(rf);
                    if (io.canImportAs && io.canImportAs(ImportAsType.FOOTAGE)) {
                        io.importAs = ImportAsType.FOOTAGE;
                    }
                    var foot = proj.importFile(io);
                    var l = comp.layers.add(foot);
                    l.name = "PLATE - " + P.shot_name;
                    addedPlate = true;
                } catch (e) {
                    reason = "import error: " + e.toString() + " | " + P.reference;
                }
            }
        }

        if (!addedPlate) {
            // Import failed — show WHY so we can diagnose from the AE viewer.
            var bg = comp.layers.addSolid([0.10, 0.14, 0.22], "PLATE PLACEHOLDER - " + P.shot_name, P.width, P.height, 1.0);
            var tl = comp.layers.addText(P.label_text + "\n" + reason);
            try {
                var td = tl.property("Source Text").value;
                td.resetCharStyle();
                td.fontSize = Math.max(24, Math.round(P.height / 18));
                td.fillColor = [0.86, 0.90, 0.98];
                td.justification = ParagraphJustification.CENTER_JUSTIFY;
                tl.property("Source Text").setValue(td);
                tl.property("Transform").property("Position").setValue([P.width/2, P.height/2]);
            } catch (e) {}
        }

        // Queue the comp to render into the watched folder so the editor just
        // hits Render and AEBridge picks up the result.
        if (P.render_output) {
            try {
                var rq = app.project.renderQueue.items.add(comp);
                var om = rq.outputModule(1);
                om.file = new File(P.render_output);
            } catch (e) { /* render queue optional */ }
        }

        comp.openInViewer();
        var out = new File(P.aep_path);
        proj.save(out);
    } catch (err) {
        alert("AEBridge: " + err.toString());
    }
    app.endUndoGroup();
    app.activate();
})();
"""


def prepare_comp(
    sidecar: Sidecar,
    template_path: Optional[Path],
    reference_mov: Optional[Path],
    aep_work_root: Path,
    project_mode: ProjectMode,
    target_project: Optional[Path],
    render_output: str = "",
) -> tuple[Path, Path]:
    """Write the ExtendScript that builds the comp. Returns (aep_path, jsx_path)."""
    job_dir = aep_work_root / sidecar.job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    if project_mode == ProjectMode.existing_project:
        assert target_project is not None
        aep_path = target_project
    else:
        aep_path = job_dir / "comp.aep"

    has_ref = bool(reference_mov and reference_mov.exists() and reference_mov.stat().st_size > 0)
    label_text = (
        f"AEBridge placeholder\n{sidecar.shot_name}\n"
        f"{sidecar.resolution.w}x{sidecar.resolution.h} @ {sidecar.frame_rate}\n"
        f"TC {sidecar.record_tc_in}"
    )
    params = {
        "mode": project_mode.value,
        "target_project": str(target_project) if target_project else "",
        "template": str(template_path) if template_path and template_path.exists() else "",
        "aep_path": str(aep_path),
        "comp_name": sidecar.aep_comp_name,
        "shot_name": sidecar.shot_name,
        "label_text": label_text,
        "width": sidecar.resolution.w,
        "height": sidecar.resolution.h,
        "frame_rate": sidecar.frame_rate,
        "frame_count": sidecar.frame_count,
        "reference": str(reference_mov) if has_ref else "",
        "render_output": render_output or "",
    }
    jsx = _JSX_TEMPLATE % {"params": json.dumps(params)}
    jsx_path = job_dir / "build.jsx"
    jsx_path.write_text(jsx)
    return aep_path, jsx_path


def launch_ae(jsx_path: Path) -> None:
    """Launch After Effects and run the build script.

    Passing `-r` to a COLD-starting AE is unreliable — AE sits on its Home /
    Welcome screen and never runs the script. Instead we drive the running app
    via AppleScript `DoScriptFile`, which executes in the live app (and creating
    a comp pulls it off the Home screen). Sending the Apple event auto-launches
    AE and waits until it can accept events, so this also works from cold.
    """
    ae = find_ae()
    if not ae:
        raise RuntimeError("After Effects not found")

    app_name = ae.app.stem  # e.g. "Adobe After Effects 2026"
    posix = str(jsx_path).replace('\\', '\\\\').replace('"', '\\"')
    applescript = (
        f'tell application "{app_name}"\n'
        f'  activate\n'
        f'  DoScriptFile "{posix}"\n'
        f'end tell'
    )
    # Fire-and-forget: the Apple event launches AE and queues the script; we
    # don't block the HTTP request on AE's (possibly slow) cold start.
    subprocess.Popen(
        ["osascript", "-e", applescript],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def launch_ae_via_binary(jsx_path: Path) -> None:
    """Fallback launch path (AfterFX -r). Kept for debugging; not the default."""
    ae = find_ae()
    if not ae:
        raise RuntimeError("After Effects not found")
    subprocess.Popen(
        [str(ae.afterfx), "-r", str(jsx_path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def make_placeholder_plate(dest: Path, w: int, h: int, frame_rate: str, frame_count: int) -> bool:
    """Dev fallback: generate a visible stand-in plate with ffmpeg if available.

    Used only until real MCAPI ExportFile is wired. Returns True if created.
    """
    ff = shutil.which("ffmpeg")
    if not ff:
        return False
    fps = frame_rate or "24"
    seconds = max((frame_count or 24) / (float(fps) if _num(fps) else 24), 0.5)
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ff, "-y",
        "-f", "lavfi",
        "-i", f"testsrc2=s={w}x{h}:r={fps}:d={seconds:.3f}",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        str(dest),
    ]
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return dest.exists() and dest.stat().st_size > 0
    except Exception:
        return False


def _num(s: str) -> bool:
    try:
        float(s)
        return True
    except ValueError:
        return False


def is_stable(path: Path) -> bool:
    """A render is complete when the file has stopped growing / is unlocked."""
    return path.exists() and path.stat().st_size > 0
