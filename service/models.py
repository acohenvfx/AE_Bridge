"""Pydantic schemas for the AEBridge route contract and the shot sidecar."""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ProjectMode(str, Enum):
    new_per_shot = "new_per_shot"
    existing_project = "existing_project"


class JobState(str, Enum):
    exporting = "exporting"
    ready_in_ae = "ready_in_ae"
    rendering = "rendering"
    returned = "returned"
    validated = "validated"
    offered = "offered"
    swapped = "swapped"
    done = "done"
    error = "error"


class Resolution(BaseModel):
    w: int
    h: int


class ClientShot(BaseModel):
    """Shot metadata gathered by the panel via MCAPI (client-side)."""

    shot_name: str
    sequence_name: str = ""
    record_tc_in: str = ""
    record_tc_out: str = ""
    source_tc_in: str = ""
    frame_rate: str = "24"
    drop_frame: bool = False
    resolution: Resolution = Resolution(w=1920, h=1080)
    frame_count: int = 0


class PlateRef(BaseModel):
    """One plate in a shot's vertical stack (V1 base + tracks above)."""

    name: str
    file: str
    track: int = 1
    order: int = 1  # 1 = bottom (V1) .. N = top
    offset_frames: int = 0  # AE layer start relative to the V1 plate file


class SendRequest(BaseModel):
    template_id: str
    handles: int = Field(0, ge=0, le=120)
    auto_swap: bool = False
    project_mode: ProjectMode = ProjectMode.new_per_shot
    # Opaque token from /pick-project; required for existing_project mode.
    target_project_token: Optional[str] = None
    # Avid path: job from /prepare + shot gathered by the panel via MCAPI + the
    # reference the panel exported. Absent in dev (browser) -> stub shot.
    job_id: Optional[str] = None
    shot: Optional[ClientShot] = None
    reference_path: Optional[str] = None
    # Multi-plate stack (V1 first). When absent, reference_path alone is used.
    plates: Optional[list[PlateRef]] = None


class PrepareRequest(BaseModel):
    # Shot name (from the panel's grab) so the folder is <date>_<shot>.
    name: Optional[str] = None


class ParseEdlRequest(BaseModel):
    edl_path: str
    rec_in: Optional[str] = None
    rec_out: Optional[str] = None
    fps: int = 24


class EdlClip(BaseModel):
    num: str
    clip_name: str = ""
    rec_in: str
    rec_out: str
    src_in: str
    src_out: str


class ParseEdlResponse(BaseModel):
    clips: list[EdlClip]


class PrepareResponse(BaseModel):
    job_id: str
    export_dir: str
    reference_name: str = "ref"


class PickProjectResponse(BaseModel):
    target_project_token: str
    label: str
    path: str = ""


class ImportRequest(BaseModel):
    # If omitted, helper derives one bin per reel/sequence from the sidecar.
    target_bin: Optional[str] = None


class TemplateInfo(BaseModel):
    id: str
    label: str
    description: str = ""


class Sidecar(BaseModel):
    schema_: str = Field("aebridge.sidecar/1", alias="schema")
    job_id: str
    shot_name: str
    sequence_name: str
    record_tc_in: str
    record_tc_out: str
    source_tc_in: str
    frame_rate: str
    drop_frame: bool
    resolution: Resolution
    handles: int
    frame_count: int
    reference: str = "ref.mov"
    template_id: str
    project_mode: ProjectMode
    aep_path: str
    aep_comp_name: str
    plates: list[PlateRef] = []
    version: int = 1
    created: str

    class Config:
        populate_by_name = True


class ValidationReport(BaseModel):
    rate_ok: bool
    resolution_ok: bool
    frame_count_ok: bool
    detail: str = ""

    @property
    def passed(self) -> bool:
        return self.rate_ok and self.resolution_ok and self.frame_count_ok


class JobView(BaseModel):
    job_id: str
    state: JobState
    project_mode: ProjectMode
    reference_path: Optional[str] = None
    sidecar_path: Optional[str] = None
    aep_path: Optional[str] = None
    watch_dir: Optional[str] = None
    return_path: Optional[str] = None
    return_bin: Optional[str] = None
    validation: Optional[ValidationReport] = None
    error: Optional[str] = None


class VersionResponse(BaseModel):
    helper_version: str
    feature_ids: list[str]
    min_panel_version: str
    ae_version: Optional[str] = None
    license_state: str = "not_configured"
