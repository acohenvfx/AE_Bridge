"""Small, local-media helpers used by the return validation guardrail."""
from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
from fractions import Fraction
from pathlib import Path
from typing import Any, Optional

from .models import ValidationReport


class MediaProbeError(RuntimeError):
    """The return could not be inspected with ffprobe."""


def parse_frame_rate(value: Any) -> Optional[float]:
    """Turn ffprobe/Avid rate strings (for example ``24000/1001``) into fps."""
    raw = str(value or '').strip()
    if not raw or raw.upper() in {'N/A', '0/0'}:
        return None
    try:
        if '/' in raw:
            num, den = raw.split('/', 1)
            return float(Fraction(int(num), int(den)))
        return float(raw)
    except (ValueError, ZeroDivisionError):
        return None


def probe_video(path: Path, timeout_s: int = 120) -> dict[str, Any]:
    """Read the first video stream without invoking a shell."""
    ffprobe = os.environ.get('AEBRIDGE_FFPROBE') or shutil.which('ffprobe')
    if not ffprobe:
        raise MediaProbeError('ffprobe is not installed or is not on PATH')
    if not path.is_file() or path.stat().st_size <= 0:
        raise MediaProbeError('return file is missing or empty')

    cmd = [
        ffprobe,
        '-v', 'error',
        '-select_streams', 'v:0',
        '-count_frames',
        '-show_entries',
        'stream=width,height,avg_frame_rate,r_frame_rate,nb_read_frames,nb_frames',
        '-of', 'json',
        str(path),
    ]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise MediaProbeError(f'ffprobe failed: {exc}') from exc
    if result.returncode != 0:
        detail = (result.stderr or '').strip().splitlines()[-1:]
        suffix = f': {detail[0]}' if detail else ''
        raise MediaProbeError(f'ffprobe rejected the return{suffix}')
    try:
        streams = json.loads(result.stdout or '{}').get('streams') or []
        stream = streams[0]
    except (json.JSONDecodeError, IndexError, TypeError, KeyError) as exc:
        raise MediaProbeError('ffprobe returned no video stream metadata') from exc

    def as_int(value: Any) -> Optional[int]:
        try:
            if value in (None, '', 'N/A'):
                return None
            return int(value)
        except (TypeError, ValueError):
            return None

    rate_raw = stream.get('avg_frame_rate') or stream.get('r_frame_rate')
    return {
        'frame_rate': parse_frame_rate(rate_raw),
        'frame_rate_raw': str(rate_raw or ''),
        'width': as_int(stream.get('width')),
        'height': as_int(stream.get('height')),
        'frame_count': as_int(stream.get('nb_read_frames')) or as_int(stream.get('nb_frames')),
    }


def validate_video(
    actual: dict[str, Any],
    expected_frame_rate: str,
    expected_width: int,
    expected_height: int,
    expected_frame_count: int,
) -> ValidationReport:
    """Compare a probed return to the metadata captured before Send."""
    expected_rate = parse_frame_rate(expected_frame_rate)
    actual_rate = actual.get('frame_rate')
    rate_ok = (
        expected_rate is not None
        and actual_rate is not None
        and math.isclose(actual_rate, expected_rate, rel_tol=0.0, abs_tol=0.01)
    )
    resolution_ok = (
        actual.get('width') == expected_width
        and actual.get('height') == expected_height
    )
    frame_count_ok = (
        expected_frame_count > 0
        and actual.get('frame_count') is not None
        and actual.get('frame_count') == expected_frame_count
    )

    details = []
    if not rate_ok:
        details.append(
            f"frame rate {actual.get('frame_rate_raw') or actual_rate or 'unknown'} "
            f"!= expected {expected_frame_rate or 'unknown'}"
        )
    if not resolution_ok:
        actual_size = f"{actual.get('width') or '?'}x{actual.get('height') or '?'}"
        details.append(f'resolution {actual_size} != expected {expected_width}x{expected_height}')
    if not frame_count_ok:
        details.append(
            f"frame count {actual.get('frame_count') or 'unknown'} "
            f"!= expected {expected_frame_count or 'unknown'}"
        )
    detail = '; '.join(details) or (
        f"validated {actual.get('width')}x{actual.get('height')} / "
        f"{actual.get('frame_rate_raw') or actual.get('frame_rate')} fps / "
        f"{actual.get('frame_count')} frames"
    )
    return ValidationReport(
        rate_ok=rate_ok,
        resolution_ok=resolution_ok,
        frame_count_ok=frame_count_ok,
        detail=detail,
    )
