"""Focused tests for the local ffprobe return guardrail."""
import json
from types import SimpleNamespace

import service.media as media


def test_probe_video_reads_rational_rate_and_frame_count(tmp_path, monkeypatch):
    movie = tmp_path / "return.mov"
    movie.write_bytes(b"not actually decoded by this unit test")
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append((cmd, kwargs))
        return SimpleNamespace(
            returncode=0,
            stdout=json.dumps({
                "streams": [{
                    "width": 1920,
                    "height": 1080,
                    "avg_frame_rate": "24000/1001",
                    "r_frame_rate": "24000/1001",
                    "nb_read_frames": "90",
                }],
            }),
            stderr="",
        )

    # probe_video prefers the bundled native probe now, so force the ffprobe
    # fallback branch — this test is specifically about parsing ffprobe output.
    monkeypatch.setattr(media, "resolve_probe", lambda: None)
    monkeypatch.setattr(media.shutil, "which", lambda name: "/usr/bin/ffprobe")
    monkeypatch.setattr(media.subprocess, "run", fake_run)

    actual = media.probe_video(movie)

    assert actual["frame_rate"] == 24000 / 1001
    assert actual["frame_rate_raw"] == "24000/1001"
    assert actual["width"] == 1920
    assert actual["height"] == 1080
    assert actual["frame_count"] == 90
    assert "-count_frames" in calls[0][0]
    assert calls[0][1]["check"] is False


def test_validate_video_accepts_rounded_avid_rate():
    report = media.validate_video(
        {
            "frame_rate": 24000 / 1001,
            "frame_rate_raw": "24000/1001",
            "width": 1920,
            "height": 1080,
            "frame_count": 90,
        },
        expected_frame_rate="23.976",
        expected_width=1920,
        expected_height=1080,
        expected_frame_count=90,
    )

    assert report.passed
    assert "validated" in report.detail


def test_validate_video_blocks_wrong_rate_size_and_duration():
    report = media.validate_video(
        {
            "frame_rate": 24.0,
            "frame_rate_raw": "24/1",
            "width": 1280,
            "height": 720,
            "frame_count": 89,
        },
        expected_frame_rate="23.976",
        expected_width=1920,
        expected_height=1080,
        expected_frame_count=90,
    )

    assert not report.passed
    assert not report.rate_ok
    assert not report.resolution_ok
    assert not report.frame_count_ok
    assert "frame rate" in report.detail
    assert "resolution" in report.detail
    assert "frame count" in report.detail


def test_validate_video_skips_frame_count_check_when_never_captured():
    """expected_frame_count == 0 means the count was never captured at grab
    time (a real, reproduced gap — see HANDOFF.md), not a confirmed mismatch.
    It must not permanently block Import: rate/resolution still gate, but the
    frame-count check is skipped rather than an unconditional failure."""
    report = media.validate_video(
        {
            "frame_rate": 24000 / 1001,
            "frame_rate_raw": "24000/1001",
            "width": 1920,
            "height": 1080,
            "frame_count": 197,
        },
        expected_frame_rate="23.98",
        expected_width=1920,
        expected_height=1080,
        expected_frame_count=0,
    )

    assert report.passed
    assert report.frame_count_ok
    assert "not checked" in report.detail
    assert "unknown" not in report.detail


def test_validate_video_still_blocks_wrong_rate_when_frame_count_unknown():
    """The frame-count skip must not weaken the other guardrails."""
    report = media.validate_video(
        {
            "frame_rate": 30.0,
            "frame_rate_raw": "30/1",
            "width": 1920,
            "height": 1080,
            "frame_count": 197,
        },
        expected_frame_rate="23.98",
        expected_width=1920,
        expected_height=1080,
        expected_frame_count=0,
    )

    assert not report.passed
    assert not report.rate_ok
    assert report.frame_count_ok


def test_native_probe_matches_ffprobe_on_real_media():
    """The native AVFoundation probe replaced ffprobe; it must agree with it.

    The trap this guards: a QuickTime edit list ('elst') can present fewer
    frames than the container stores. Counting stored samples reported 1071
    for an Avid plate that ffprobe (and Avid) call 1067 — and validation
    compares frame counts for EXACT equality, so that would have failed good
    renders. Skips unless both probes and some real media are present.
    """
    import json as _json
    import shutil as _shutil
    import subprocess as _subprocess
    from pathlib import Path as _Path

    import pytest

    probe = media.resolve_probe()
    ffprobe = _shutil.which('ffprobe')
    if not probe or not ffprobe:
        pytest.skip('need both the native probe and ffprobe to compare')

    media_dir = _Path.home() / 'Desktop' / 'AEBridge' / 'plates'
    clips = sorted(media_dir.glob('*.mov'))[:3] if media_dir.is_dir() else []
    if not clips:
        pytest.skip('no sample media available')

    for clip in clips:
        out = _subprocess.run([probe, str(clip)], capture_output=True, text=True, check=True)
        native = _json.loads(out.stdout)
        ff = _subprocess.run(
            [ffprobe, '-v', 'error', '-select_streams', 'v:0', '-count_frames',
             '-show_entries', 'stream=width,height,nb_read_frames',
             '-of', 'json', str(clip)],
            capture_output=True, text=True, check=True,
        )
        stream = _json.loads(ff.stdout)['streams'][0]
        assert native['width'] == stream['width'], clip.name
        assert native['height'] == stream['height'], clip.name
        assert native['frame_count'] == int(stream['nb_read_frames']), clip.name
