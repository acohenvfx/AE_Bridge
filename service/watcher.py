"""Return watch-folder loop.

Background thread: for jobs waiting on an AE render (state ready_in_ae), scan
the job's watch dir for a completed render (a media file whose size has stopped
growing). When one appears, record it and flip the job to `returned`. The panel
polls /jobs and does the Avid import via MCAPI.
"""
from __future__ import annotations

import threading
import time
from pathlib import Path
from typing import Optional

from .jobs import store
from .models import JobState

_MEDIA_EXTS = {".mov", ".mxf", ".mp4", ".m4v", ".avi", ".mkv"}


def _newest_media(watch_dir: Path) -> Optional[Path]:
    if not watch_dir or not watch_dir.exists():
        return None
    files = [
        p for p in watch_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in _MEDIA_EXTS and p.stat().st_size > 0
    ]
    return max(files, key=lambda p: p.stat().st_mtime) if files else None


class ReturnWatcher:
    def __init__(self, interval: float = 2.0, stable_reads: int = 3) -> None:
        self.interval = interval
        self.stable_reads = stable_reads
        self._sizes: dict[str, tuple[str, int, int]] = {}  # job_id -> (path, size, stable count)
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="aebridge-watcher", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                self._tick()
            except Exception:
                pass  # never let the watcher die on a transient error
            self._stop.wait(self.interval)

    def _tick(self) -> None:
        for job in store.all():
            if job.state != JobState.ready_in_ae or not job.watch_dir:
                continue
            cand = _newest_media(job.watch_dir)
            if cand is None:
                continue
            size = cand.stat().st_size
            prev = self._sizes.get(job.job_id)
            if prev and prev[0] == str(cand) and prev[1] == size:
                count = prev[2] + 1
                self._sizes[job.job_id] = (str(cand), size, count)
                if count >= self.stable_reads:  # render finished flushing
                    job.return_path = cand
                    job.transition(JobState.returned)
                    self._sizes.pop(job.job_id, None)
            else:
                self._sizes[job.job_id] = (str(cand), size, 0)


watcher = ReturnWatcher()
