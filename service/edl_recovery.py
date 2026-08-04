"""Recover EDLs that Avid writes while reporting ExportEDL error 1000."""
from __future__ import annotations

import re
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional


# Where Avid actually writes ExportEDL output: `<SequenceName>.NNN.edl` with a
# three-digit per-sequence-name counter (001-999) that fills up and then makes
# EVERY export under that name fail with ErrorType 1000 (see HANDOFF.md).
# CONFIRMED against a real installation 2026-08-04: 772 EDLs live directly
# under `~/Avid EDL Exports`; zero exist under the previous guess below.
AVID_GENERATED_EDL_ROOT = Path.home() / "Avid EDL Exports"

DEFAULT_EDL_ROOTS = (
    AVID_GENERATED_EDL_ROOT,
    Path.home() / "Desktop",
)


def _key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def _title(path: Path) -> str:
    try:
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            for _ in range(8):
                line = handle.readline()
                if not line:
                    break
                match = re.match(r"\s*TITLE\s*:\s*(.*?)\s*$", line, re.IGNORECASE)
                if match:
                    return match.group(1)
    except OSError:
        return ""
    return ""


def find_recent_edl(
    sequence_name: str,
    since_ms: int,
    roots: Iterable[Path] = DEFAULT_EDL_ROOTS,
) -> Optional[Path]:
    """Return the newest matching EDL written at or just after an RPC began.

    The one-second tolerance handles timestamp rounding, while the EDL TITLE
    match prevents an unrelated List Tool export from being selected.
    """
    threshold_ns = max(0, int(since_ms) - 1000) * 1_000_000
    wanted = _key(sequence_name)
    candidates: list[tuple[int, Path]] = []
    for root in roots:
        try:
            paths = root.glob("*.edl")
            for path in paths:
                try:
                    stat = path.stat()
                except OSError:
                    continue
                if not path.is_file() or stat.st_size <= 0 or stat.st_mtime_ns < threshold_ns:
                    continue
                if wanted and _key(_title(path)) != wanted:
                    continue
                candidates.append((stat.st_mtime_ns, path.resolve()))
        except OSError:
            continue
    return max(candidates, default=(0, None), key=lambda item: item[0])[1]


def archive_generated_edl(source: Path, destination_root: Path) -> Path:
    """Move Avid's transient EDL into AEBridge's dedicated workspace.

    Only files directly inside Avid's generated-EDL directory are moved. A
    path from any other location is returned untouched so a user's manual EDL
    can never be relocated as a side effect of parsing.
    """
    source = source.expanduser().resolve()
    if source.parent != AVID_GENERATED_EDL_ROOT.resolve():
        return source
    destination_root.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    destination = destination_root / f"{source.stem}_{stamp}_{time.time_ns() % 1_000_000_000:09d}.edl"
    shutil.move(str(source), str(destination))
    return destination.resolve()
