"""/v1/version — feature detection so the panel shows 'Update AEBridge Helper'
rather than a raw 404 when a route/feature is missing."""
from __future__ import annotations

from fastapi import APIRouter

from ..config import FEATURE_IDS, HELPER_VERSION, MIN_PANEL_VERSION, settings
from ..models import VersionResponse

router = APIRouter()


@router.get("/v1/version", response_model=VersionResponse)
def version() -> VersionResponse:
    return VersionResponse(
        helper_version=HELPER_VERSION,
        feature_ids=FEATURE_IDS,
        min_panel_version=MIN_PANEL_VERSION,
        ae_version=settings.ae_version,
    )
