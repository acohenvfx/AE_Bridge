"""In-memory job store + state machine + opaque project-token registry.

A real helper would persist jobs (and probably survive restarts); in-memory is
fine for the prototype. Tokens map to real `.aep` paths ONLY here, never leaving
the helper.
"""
from __future__ import annotations

import secrets
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .models import JobState, JobView, ProjectMode, Sidecar, ValidationReport

_ALLOWED_TRANSITIONS = {
    # The watcher jumps ready_in_ae -> returned when a render appears; import
    # from the panel takes returned -> done.
    JobState.exporting: {JobState.ready_in_ae, JobState.error},
    JobState.ready_in_ae: {JobState.rendering, JobState.returned, JobState.error},
    JobState.rendering: {JobState.returned, JobState.error},
    JobState.returned: {JobState.validated, JobState.done, JobState.error},
    JobState.validated: {JobState.offered, JobState.swapped, JobState.done, JobState.error},
    JobState.offered: {JobState.swapped, JobState.done, JobState.error},
    JobState.swapped: {JobState.done, JobState.error},
    JobState.done: set(),
    JobState.error: set(),
}


class InvalidTransition(RuntimeError):
    pass


@dataclass
class Job:
    job_id: str
    project_mode: ProjectMode
    state: JobState = JobState.exporting
    reference_path: Optional[Path] = None
    sidecar_path: Optional[Path] = None
    aep_path: Optional[Path] = None
    watch_dir: Optional[Path] = None
    return_path: Optional[Path] = None
    return_bin: Optional[str] = None
    sidecar: Optional[Sidecar] = None
    validation: Optional[ValidationReport] = None
    error: Optional[str] = None

    def transition(self, to: JobState) -> None:
        if to not in _ALLOWED_TRANSITIONS[self.state]:
            raise InvalidTransition(f"{self.state} -> {to}")
        self.state = to

    def fail(self, reason: str) -> None:
        self.error = reason
        self.state = JobState.error

    def view(self) -> JobView:
        return JobView(
            job_id=self.job_id,
            state=self.state,
            project_mode=self.project_mode,
            reference_path=str(self.reference_path) if self.reference_path else None,
            sidecar_path=str(self.sidecar_path) if self.sidecar_path else None,
            aep_path=str(self.aep_path) if self.aep_path else None,
            watch_dir=str(self.watch_dir) if self.watch_dir else None,
            return_path=str(self.return_path) if self.return_path else None,
            return_bin=self.return_bin,
            validation=self.validation,
            error=self.error,
        )


@dataclass
class _SessionMemory:
    """Last-used choices so the editor picks once per session."""

    project_mode: ProjectMode = ProjectMode.new_per_shot
    target_project_token: Optional[str] = None


class Store:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._tokens: dict[str, Path] = {}
        self._lock = threading.Lock()
        self.session = _SessionMemory()

    # --- jobs ---
    def new_job_id(self, shot_name: str) -> str:
        stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        with self._lock:
            n = sum(1 for k in self._jobs if shot_name in k) + 1
        return f"aeb_{stamp}_{shot_name}_{n:03d}"

    def add(self, job: Job) -> None:
        with self._lock:
            self._jobs[job.job_id] = job

    def get(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    def all(self) -> list[Job]:
        return list(self._jobs.values())

    # --- project tokens ---
    def register_project(self, path: Path) -> str:
        token = "proj_" + secrets.token_hex(8)
        with self._lock:
            self._tokens[token] = path
        self.session.target_project_token = token
        return token

    def resolve_token(self, token: str) -> Optional[Path]:
        return self._tokens.get(token)


store = Store()
