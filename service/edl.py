"""Minimal CMX3600 EDL parser.

Used to enumerate the individual clips on a track (MCAPI exposes only
num_segments, not per-clip boundaries). The panel runs ExportEDL on a single
track; the helper reads and parses the resulting file into events with record
in/out + clip name.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

_TC = r"\d{2}:\d{2}:\d{2}[:;]\d{2}"
# 001  AX  V  C  <srcIn> <srcOut> <recIn> <recOut>
_EVENT = re.compile(
    rf"^\s*(\d+)\s+(\S+)\s+([AVB][/\dAV]*)\s+(\S+)\s+({_TC})\s+({_TC})\s+({_TC})\s+({_TC})"
)
_FROM_CLIP = re.compile(r"^\*\s*FROM CLIP NAME:\s*(.+?)\s*$", re.IGNORECASE)
_CLIP_NAME = re.compile(r"^\*\s*(?:CLIP NAME|TO CLIP NAME):\s*(.+?)\s*$", re.IGNORECASE)


@dataclass
class EdlEvent:
    num: str
    reel: str
    track: str
    src_in: str
    src_out: str
    rec_in: str
    rec_out: str
    clip_name: str = ""


def parse_edl(text: str) -> list[EdlEvent]:
    events: list[EdlEvent] = []
    last: EdlEvent | None = None
    for line in text.splitlines():
        m = _EVENT.match(line)
        if m:
            last = EdlEvent(
                num=m.group(1), reel=m.group(2), track=m.group(3),
                src_in=m.group(5), src_out=m.group(6),
                rec_in=m.group(7), rec_out=m.group(8),
            )
            events.append(last)
            continue
        if last is not None:
            fm = _FROM_CLIP.match(line) or _CLIP_NAME.match(line)
            if fm and not last.clip_name:
                last.clip_name = fm.group(1)
    return events


def _tc_to_frames(tc: str, fps: int = 24) -> int:
    m = re.match(r"(\d{2}):(\d{2}):(\d{2})[:;](\d{2})", tc or "")
    if not m:
        return 0
    hh, mm, ss, ff = (int(x) for x in m.groups())
    return ((hh * 60 + mm) * 60 + ss) * fps + ff


def filter_to_range(
    events: list[EdlEvent], rec_in: str | None, rec_out: str | None, fps: int = 24
) -> list[EdlEvent]:
    """Keep events whose record span overlaps [rec_in, rec_out)."""
    if not rec_in or not rec_out:
        return events
    lo, hi = _tc_to_frames(rec_in, fps), _tc_to_frames(rec_out, fps)
    out = []
    for e in events:
        a, b = _tc_to_frames(e.rec_in, fps), _tc_to_frames(e.rec_out, fps)
        if a < hi and b > lo:  # overlap
            out.append(e)
    return out


def read_and_parse(path: Path, rec_in: str | None = None, rec_out: str | None = None,
                   fps: int = 24) -> list[EdlEvent]:
    if not path.is_file():
        raise FileNotFoundError(str(path))
    text = path.read_text(errors="replace")[:2_000_000]  # cap
    return filter_to_range(parse_edl(text), rec_in, rec_out, fps)
