"""Allowed-root path safety.

Central rule: any path that crosses /v1/ is normalized (resolve symlinks + `..`)
and must sit under an allowed root — except an editor-chosen `.aep` target,
which is a deliberate user authorization surfaced only via an opaque token.
"""
from __future__ import annotations

from pathlib import Path


class PathNotAllowed(ValueError):
    """Raised when a path escapes every allowed root."""


def normalize(path: str | Path) -> Path:
    """Resolve symlinks and `..`; does not require existence."""
    return Path(path).expanduser().resolve()


def is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root.resolve())
        return True
    except ValueError:
        return False


def ensure_within(path: str | Path, roots: list[Path]) -> Path:
    """Return the normalized path if under one of roots, else raise."""
    p = normalize(path)
    for root in roots:
        if is_within(p, root):
            return p
    raise PathNotAllowed(f"path escapes allowed roots: {p}")


def validate_aep_selection(path: str | Path) -> Path:
    """Validate an editor-picked `.aep` target.

    Allowed outside the configured roots (deliberate user choice) but must be an
    existing, readable `.aep`. Re-run at write time as well.
    """
    p = normalize(path)
    if p.suffix.lower() != ".aep":
        raise PathNotAllowed(f"not an .aep file: {p}")
    if not p.is_file():
        raise PathNotAllowed(f"file not found: {p}")
    return p
