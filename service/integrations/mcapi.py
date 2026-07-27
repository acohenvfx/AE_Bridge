"""Avid MCAPI seam.

Real implementation talks grpc-web MCAPI (same stack the EB helper uses). Here
we return deterministic fake data so the route contract is exercisable without
Avid running. Every function is a named MCAPI call from the design spec.
"""
from __future__ import annotations

from ..models import Resolution


class MediaComposerNotRunning(RuntimeError):
    pass


def get_open_project_info() -> dict:
    """GetOpenProjectInfo — project rate/res defaults."""
    return {"frame_rate": "23.976", "drop_frame": False, "resolution": Resolution(w=1920, h=1080)}


def get_selected_shot() -> dict:
    """Resolve selected mob -> GetMobInfo. Helper never trusts a panel path."""
    return {
        "shot_name": "A017C003",
        "sequence_name": "REEL_2_v14",
        "record_tc_in": "01:02:11:04",
        "record_tc_out": "01:02:14:22",
        "source_tc_in": "12:41:08:00",
        "frame_rate": "23.976",
        "drop_frame": False,
        "resolution": Resolution(w=1920, h=1080),
        "frame_count": 90,
    }


def export_reference(dest_mov: str, handles: int) -> None:
    """ExportFile — reference movie for the frame range (+ handles)."""
    # TODO: real MCAPI ExportFile to dest_mov.
    return None


def import_return(return_mov: str, target_bin: str) -> None:
    """LinkFile / ImportFile — bring the render into Avid into target_bin."""
    # TODO: real MCAPI LinkFile/ImportFile.
    return None


def swap_at_record_tc(return_mov: str, record_tc_in: str) -> None:
    """Place the return at record TC in the record sequence."""
    # TODO: real MCAPI edit at record_tc_in.
    return None


def stamp_version(shot_name: str, version: int) -> None:
    """SetMobInfo — write the version stamp back."""
    # TODO: real MCAPI SetMobInfo.
    return None
