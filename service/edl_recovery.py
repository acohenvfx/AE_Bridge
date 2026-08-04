"""Recover EDLs that Avid writes while reporting ExportEDL error 1000."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable, Optional


DEFAULT_EDL_ROOTS = (
    Path("/Users/Shared/AvidMediaComposer/Avid Users"),
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
