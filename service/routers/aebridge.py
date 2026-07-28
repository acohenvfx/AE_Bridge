"""/v1/aebridge/* — the round-trip route contract.

Every path crossing this boundary is resolved by the helper from config or a
token; the panel never supplies raw paths (except by picking an .aep through the
helper's own native dialog, which returns a token).
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Media containers MC's ExportFile might produce for a reference movie.
_MEDIA_EXTS = {".mov", ".mxf", ".mp4", ".m4v", ".avi", ".mkv"}


def _newest_media(claimed: Path, job_export_dir: Path) -> Optional[Path]:
    if claimed.exists() and claimed.stat().st_size > 0:
        return claimed
    # Shared plates folder: match by the claimed filename stem (MC appends the
    # codec extension), NOT just "newest" — which could be another shot's plate.
    search_dir = claimed.parent if str(claimed.parent).strip() else job_export_dir
    stem = claimed.stem
    candidates = []
    for d in {search_dir, job_export_dir}:
        if d.exists():
            candidates += [
                p for p in d.glob("*")
                if p.is_file() and p.suffix.lower() in _MEDIA_EXTS and p.stat().st_size > 0
                and (p.stem == stem or p.stem.startswith(stem))
            ]
    return max(candidates, key=lambda p: p.stat().st_mtime) if candidates else None


def _resolve_exported_reference(
    claimed: Path,
    job_export_dir: Path,
    wait_s: float = 180.0,
    interval: float = 0.5,
    stable_reads: int = 4,
) -> Optional[Path]:
    """Find the movie MC actually exported AND wait until it's fully written.

    MC's ExportFile RPC returns before the file is flushed, and MC may name it
    per the export preset (not our 'ref'). So: locate the newest media file in
    the job's export dir, then wait until its size stops changing for several
    consecutive reads before handing it to After Effects (a partially-written
    file imports as an empty/solid layer).
    """
    deadline = time.monotonic() + wait_s
    chosen: Optional[Path] = None
    last_size = -1
    stable = 0
    while time.monotonic() < deadline:
        cand = _newest_media(claimed, job_export_dir)
        if cand is None:
            time.sleep(interval)
            continue
        size = cand.stat().st_size
        if cand == chosen and size == last_size:
            stable += 1
            if stable >= stable_reads:  # size held steady -> export finished
                return cand
        else:
            chosen, stable = cand, 0
        last_size = size
        time.sleep(interval)
    return chosen  # best effort at timeout

from fastapi import APIRouter, HTTPException

from ..config import settings
from ..integrations import ae, macos, mcapi
from ..jobs import Job, store
from ..models import (
    EdlClip,
    ImportRequest,
    JobState,
    JobView,
    ParseEdlRequest,
    ParseEdlResponse,
    PickProjectResponse,
    PrepareRequest,
    PrepareResponse,
    ProjectMode,
    SendRequest,
    Sidecar,
    TemplateInfo,
    ValidationReport,
)
from .. import edl as edl_parser
from ..paths import (
    PathNotAllowed,
    ensure_within,
    validate_aep_save_target,
    validate_aep_selection,
)

router = APIRouter(prefix="/v1/aebridge")


# --- templates -------------------------------------------------------------
BLANK_TEMPLATE_ID = "__blank__"


@router.get("/templates", response_model=list[TemplateInfo])
def list_templates() -> list[TemplateInfo]:
    # Always offer a blank comp so Send works with no templates installed.
    out: list[TemplateInfo] = [
        TemplateInfo(id=BLANK_TEMPLATE_ID, label="Blank comp (no template)",
                     description="New comp sized to the shot, no template applied.")
    ]
    root = settings.roots.template_root
    if root.exists():
        for p in sorted(root.glob("*.aep")):
            out.append(TemplateInfo(id=p.stem, label=p.stem.replace("_", " ")))
    return out


def _resolve_template(template_id: str) -> Optional[Path]:
    """Templates chosen by id, resolved against template_root.

    A blank/empty id means 'no template' — build a fresh comp from scratch.
    """
    if not template_id or template_id == BLANK_TEMPLATE_ID:
        return None
    candidate = settings.roots.template_root / f"{template_id}.aep"
    return ensure_within(candidate, [settings.roots.template_root])


# --- After Effects diagnostics --------------------------------------------
@router.get("/ae")
def ae_status() -> dict:
    """Where the helper looked for After Effects and what it found."""
    return ae.diagnostics()


# --- EDL parse (clip enumeration) -----------------------------------------
@router.post("/parse-edl", response_model=ParseEdlResponse)
def parse_edl(req: ParseEdlRequest) -> ParseEdlResponse:
    """Parse an EDL the panel exported (for one track) into per-clip events with
    record in/out — used to enumerate the V1 clips in the marked range."""
    path = Path(req.edl_path).expanduser()
    try:
        events = edl_parser.read_and_parse(path, req.rec_in, req.rec_out, req.fps)
    except FileNotFoundError:
        raise HTTPException(status_code=400, detail=f"EDL not found: {path}")
    return ParseEdlResponse(clips=[
        EdlClip(num=e.num, clip_name=e.clip_name, rec_in=e.rec_in, rec_out=e.rec_out,
                src_in=e.src_in, src_out=e.src_out)
        for e in events
    ])


# --- project picker --------------------------------------------------------
@router.post("/pick-project", response_model=PickProjectResponse)
def pick_project(path: Optional[str] = None) -> PickProjectResponse:
    """Open the helper's native .aep picker and return an opaque token.

    `path` param exists so the prototype (and tests) can inject a selection;
    production ignores it and opens the real macOS dialog.
    """
    selected = path if path is not None else macos.choose_aep()
    if selected is None:
        raise HTTPException(status_code=400, detail="no project selected")
    try:
        resolved = validate_aep_selection(selected)
    except PathNotAllowed as e:
        raise HTTPException(status_code=400, detail=str(e))
    token = store.register_project(resolved)
    return PickProjectResponse(target_project_token=token, label=resolved.name, path=str(resolved))


@router.post("/new-project", response_model=PickProjectResponse)
def new_project(path: Optional[str] = None) -> PickProjectResponse:
    """Open a native 'save new .aep' dialog (name + location) and return a token.
    Used by new-project mode so the editor names/places the project."""
    selected = path if path is not None else macos.choose_save_aep()
    if selected is None:
        raise HTTPException(status_code=400, detail="no location chosen")
    try:
        resolved = validate_aep_save_target(selected)
    except PathNotAllowed as e:
        raise HTTPException(status_code=400, detail=str(e))
    token = store.register_project(resolved)
    return PickProjectResponse(target_project_token=token, label=resolved.name, path=str(resolved))


# --- prepare (Avid path) ---------------------------------------------------
def _sanitize(name: Optional[str]) -> str:
    s = "".join(c if c.isalnum() or c in "-_." else "_" for c in (name or "").strip())
    return s.strip("_.") or "shot"


def _safe_filename(name: Optional[str]) -> str:
    return "".join(c if c.isalnum() or c in "-_. " else "_" for c in (name or "").strip()) or "shot"


@router.get("/plate-exists")
def plate_exists(name: str = "") -> dict:
    """Does a plate with this shot name already exist in the plates folder?
    The panel uses this to warn before overwriting."""
    stem = _safe_filename(name)
    root = settings.roots.export_root
    matches = []
    if root.exists():
        matches = [
            p.name for p in root.glob("*")
            if p.is_file() and p.suffix.lower() in _MEDIA_EXTS and (p.stem == stem or p.stem.startswith(stem))
        ]
    return {"exists": bool(matches), "name": stem, "files": matches}


@router.post("/prepare", response_model=PrepareResponse)
def prepare(req: Optional[PrepareRequest] = None) -> PrepareResponse:
    """Reserve a job. Flat layout: all plates go in the shared `plates` folder and
    all AE renders in the shared `render` folder (files named by shot). Path
    authority stays in the helper."""
    stamp = datetime.now().strftime("%Y%m%d")
    base = f"{stamp}_{_sanitize(req.name if req else None)}"
    job_id = base
    n = 2
    while store.get(job_id) is not None:
        job_id = f"{base}_{n}"
        n += 1
    plate_dir = settings.roots.export_root  # shared plates folder
    plate_dir.mkdir(parents=True, exist_ok=True)
    ensure_within(plate_dir, [settings.roots.export_root])
    # Base name only — MC's export preset appends its own extension.
    return PrepareResponse(job_id=job_id, export_dir=str(plate_dir), reference_name="ref")


# --- send ------------------------------------------------------------------
@router.post("/send", response_model=JobView)
def send(req: SendRequest) -> JobView:
    target_project: Optional[Path] = None
    new_aep_path: Optional[Path] = None
    if req.project_mode == ProjectMode.existing_project:
        token = req.target_project_token or store.session.target_project_token
        if not token:
            raise HTTPException(status_code=400, detail="existing_project requires a project token")
        target_project = store.resolve_token(token)
        if target_project is None:
            raise HTTPException(status_code=400, detail="unknown project token")
        # Re-validate at use time.
        target_project = validate_aep_selection(target_project)
    elif req.project_mode == ProjectMode.new_per_shot and req.target_project_token:
        # Optional: editor chose where to save the new project via the dialog.
        chosen = store.resolve_token(req.target_project_token)
        if chosen is not None:
            new_aep_path = validate_aep_save_target(chosen)

    template_path = _resolve_template(req.template_id)

    # Shot metadata: from the panel (MCAPI, real Avid) when provided, else stub.
    if req.shot is not None:
        shot = {
            "shot_name": req.shot.shot_name,
            "sequence_name": req.shot.sequence_name,
            "record_tc_in": req.shot.record_tc_in,
            "record_tc_out": req.shot.record_tc_out,
            "source_tc_in": req.shot.source_tc_in,
            "frame_rate": req.shot.frame_rate,
            "drop_frame": req.shot.drop_frame,
            "resolution": req.shot.resolution,
            "frame_count": req.shot.frame_count,
        }
    else:
        shot = mcapi.get_selected_shot()

    job_id = req.job_id or store.new_job_id(shot["shot_name"])
    job = Job(job_id=job_id, project_mode=req.project_mode)
    store.add(job)

    # Flat layout: shared plates folder + shared render folder; files by shot.
    safe_name = _safe_filename(shot["shot_name"]).strip() or "shot"
    plate_dir = settings.roots.export_root
    render_dir = settings.roots.watch_root
    plate_dir.mkdir(parents=True, exist_ok=True)
    render_dir.mkdir(parents=True, exist_ok=True)
    job.watch_dir = render_dir       # AE renders here (shared)
    job.render_stem = safe_name      # the watcher matches renders by this name

    # Reference: the panel exported it via MCAPI (validate under export_root),
    # else fall back to a generated placeholder plate (dev / no real export).
    if req.reference_path:
        try:
            claimed = ensure_within(req.reference_path, [settings.roots.export_root])
        except PathNotAllowed as e:
            raise HTTPException(status_code=400, detail=f"reference outside export root: {e}")
        ref_path = _resolve_exported_reference(claimed, plate_dir)
        if ref_path is None:
            raise HTTPException(
                status_code=400,
                detail=f"no exported media found in {plate_dir} "
                f"(expected {claimed.name} or another movie file)",
            )
    else:
        ref_path = plate_dir / f"{safe_name}.mov"
        ensure_within(ref_path, [settings.roots.export_root])
        mcapi.export_reference(str(ref_path), req.handles)
        if not (ref_path.exists() and ref_path.stat().st_size > 0):
            made = ae.make_placeholder_plate(
                ref_path, shot["resolution"].w, shot["resolution"].h,
                shot["frame_rate"], shot["frame_count"],
            )
            if not made:
                ref_path.touch(exist_ok=True)

    sidecar = Sidecar(
        job_id=job_id,
        shot_name=shot["shot_name"],
        sequence_name=shot["sequence_name"],
        record_tc_in=shot["record_tc_in"],
        record_tc_out=shot["record_tc_out"],
        source_tc_in=shot["source_tc_in"],
        frame_rate=shot["frame_rate"],
        drop_frame=shot["drop_frame"],
        resolution=shot["resolution"],
        handles=req.handles,
        frame_count=shot["frame_count"],
        template_id=req.template_id,
        project_mode=req.project_mode,
        aep_path="",  # filled after comp build
        aep_comp_name=f"{shot['shot_name']}_temp",
        created=datetime.now(timezone.utc).isoformat(),
    )

    # Render output goes into the shared render folder, named after the shot.
    render_output = str(render_dir / f"{safe_name}.mov")

    aep_path, jsx_path = ae.prepare_comp(
        sidecar=sidecar,
        template_path=template_path,
        reference_mov=ref_path,
        aep_work_root=settings.roots.aep_work_root,
        project_mode=req.project_mode,
        target_project=target_project,
        render_output=render_output,
        new_aep_path=new_aep_path,
    )
    sidecar.aep_path = str(aep_path)

    sidecar_path = plate_dir / f"{safe_name}.json"
    sidecar_path.write_text(json.dumps(sidecar.model_dump(by_alias=True), indent=2))

    job.reference_path = ref_path
    job.sidecar_path = sidecar_path
    job.aep_path = aep_path
    job.sidecar = sidecar

    # Actually launch After Effects with the comp so the editor can work.
    try:
        ae.launch_ae(jsx_path)
    except RuntimeError as e:
        job.fail(str(e))
        raise HTTPException(status_code=409, detail=str(e))

    job.transition(JobState.ready_in_ae)
    store.session.project_mode = req.project_mode  # remember for the session
    return job.view()


# --- jobs ------------------------------------------------------------------
@router.get("/jobs", response_model=list[JobView])
def list_jobs() -> list[JobView]:
    return [j.view() for j in store.all()]


@router.post("/jobs/clear")
def clear_jobs(all: bool = False) -> dict:
    """Clear the jobs list. By default only finished jobs (done/error); pass
    all=true to clear everything (in-flight jobs keep their watch state)."""
    removed = store.clear_jobs(only_finished=not all)
    return {"removed": removed}


@router.get("/jobs/{job_id}", response_model=JobView)
def get_job(job_id: str) -> JobView:
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="unknown job")
    return job.view()


@router.post("/jobs/{job_id}/cancel", response_model=JobView)
def cancel(job_id: str) -> JobView:
    job = _require(job_id)
    job.fail("cancelled")
    return job.view()


# --- return ----------------------------------------------------------------
def _validate_return(job: Job, return_path: Path) -> ValidationReport:
    """Compare the return against the sidecar. Prototype trusts the sidecar's
    own numbers; real code probes the QuickTime."""
    sc = job.sidecar
    assert sc is not None
    # TODO: probe return_path with ffprobe; compare to sidecar.
    return ValidationReport(rate_ok=True, resolution_ok=True, frame_count_ok=True)


@router.post("/return/{job_id}/import", response_model=JobView)
def import_return(job_id: str, req: ImportRequest) -> JobView:
    job = _require(job_id)
    if job.return_path is None:
        raise HTTPException(status_code=409, detail="no return detected yet")
    # Returns are only accepted from inside watch_root.
    try:
        ensure_within(job.return_path, [settings.roots.watch_root])
    except PathNotAllowed as e:
        raise HTTPException(status_code=400, detail=str(e))

    report = _validate_return(job, job.return_path)
    job.validation = report
    if not report.passed:
        job.fail(f"validation failed: {report.detail}")
        raise HTTPException(status_code=422, detail=report.detail or "validation failed")

    bin_name = req.target_bin or _default_bin(job)
    mcapi.import_return(str(job.return_path), bin_name)
    if job.state == JobState.returned:
        job.transition(JobState.validated)
    return job.view()


@router.post("/return/{job_id}/imported", response_model=JobView)
def mark_imported(job_id: str, req: ImportRequest) -> JobView:
    """Record that the panel imported the return into Avid (via MCAPI) and close
    the job. The actual ImportFile runs client-side; this just updates state."""
    job = _require(job_id)
    if job.return_path is None:
        raise HTTPException(status_code=409, detail="no return detected yet")
    try:
        ensure_within(job.return_path, [settings.roots.watch_root])
    except PathNotAllowed as e:
        raise HTTPException(status_code=400, detail=str(e))
    job.return_bin = req.target_bin or _default_return_bin(job)
    if job.state in (JobState.returned, JobState.validated, JobState.offered):
        job.state = JobState.done
    return job.view()


@router.post("/return/{job_id}/swap", response_model=JobView)
def swap(job_id: str) -> JobView:
    job = _require(job_id)
    if job.state not in (JobState.validated, JobState.offered):
        raise HTTPException(status_code=409, detail=f"cannot swap from {job.state}")
    if not (job.validation and job.validation.passed):
        raise HTTPException(status_code=422, detail="return not validated")
    assert job.sidecar and job.return_path
    mcapi.swap_at_record_tc(str(job.return_path), job.sidecar.record_tc_in)
    mcapi.stamp_version(job.sidecar.shot_name, job.sidecar.version)
    job.state = JobState.swapped
    job.transition(JobState.done)
    return job.view()


def _default_bin(job: Job) -> str:
    """One bin per reel/sequence — never per shot."""
    seq = job.sidecar.sequence_name if job.sidecar else "AEBridge"
    return f"AEBridge_Temps_{seq}"


def _default_return_bin(job: Job) -> str:
    """Returns land in one bin per reel/sequence."""
    seq = job.sidecar.sequence_name if job.sidecar else "AEBridge"
    return f"AEBridge_Returns_{seq}"


def _require(job_id: str) -> Job:
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="unknown job")
    return job
