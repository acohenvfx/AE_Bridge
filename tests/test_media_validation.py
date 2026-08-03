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
