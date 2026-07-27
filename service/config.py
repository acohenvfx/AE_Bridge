"""AEBridge helper configuration.

Roots are helper-owned, never panel-supplied. Override via env vars in real
deployments; defaults point at a per-user AEBridge working area.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# AEBridge runs its OWN helper on its OWN port — deliberately NOT Elemental
# Bender's 8000. Placeholder until confirmed free on target machines.
HELPER_HOST = os.environ.get("AEBRIDGE_HOST", "127.0.0.1")
HELPER_PORT = int(os.environ.get("AEBRIDGE_PORT", "8010"))

HELPER_VERSION = "0.0.1"
FEATURE_IDS = ["aebridge"]
MIN_PANEL_VERSION = "0.0.1"

# Nuxt dev server origins allowed to call the helper cross-origin (dev only).
# Release is same-origin (helper serves the UI) and needs none of these.
DEV_PANEL_PORT = int(os.environ.get("AEBRIDGE_DEV_PANEL_PORT", "3010"))
DEV_ORIGINS = [
    f"http://localhost:{DEV_PANEL_PORT}",
    f"http://127.0.0.1:{DEV_PANEL_PORT}",
]


def _default_base() -> Path:
    return Path(
        os.environ.get(
            "AEBRIDGE_HOME",
            Path.home() / "Library" / "Application Support" / "AEBridge",
        )
    )


@dataclass(frozen=True)
class Roots:
    """Allowed roots. Every path crossing /v1/ is validated against these."""

    base: Path
    export_root: Path
    watch_root: Path
    template_root: Path
    aep_work_root: Path

    @staticmethod
    def default() -> "Roots":
        base = _default_base()
        # Exports (and returns) live on the Desktop so they're easy to find.
        desktop = Path.home() / "Desktop" / "AEBridge"
        return Roots(
            base=base,
            export_root=Path(os.environ.get("AEBRIDGE_EXPORT_ROOT", desktop / "exports")),
            watch_root=Path(os.environ.get("AEBRIDGE_WATCH_ROOT", desktop / "renders")),
            # template_root ships WITH the helper runtime (same for every artist).
            template_root=Path(
                os.environ.get("AEBRIDGE_TEMPLATE_ROOT", base / "templates")
            ),
            aep_work_root=Path(os.environ.get("AEBRIDGE_AEP_WORK_ROOT", base / "aep_work")),
        )

    def all_roots(self) -> list[Path]:
        return [self.export_root, self.watch_root, self.template_root, self.aep_work_root]

    def ensure(self) -> None:
        for r in self.all_roots():
            r.mkdir(parents=True, exist_ok=True)


@dataclass
class Settings:
    roots: Roots = field(default_factory=Roots.default)
    # Detected at startup by integrations.ae. None => After Effects not found.
    ae_version: str | None = None
    # Seconds a job may sit in `rendering` before the watcher gives up.
    render_timeout_s: int = 60 * 60


settings = Settings()
