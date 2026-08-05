"""Serves the AEBridge panel UI at /app — same-origin with the /v1 API.

Prefers the generated Nuxt static export (dist/html, from `yarn generate:release`)
and falls back to the lightweight single-page UI so the panel still works before
a Nuxt build exists. Static assets (/_nuxt, etc.) are mounted by app.py.

The panel and helper share an origin (127.0.0.1:8010), so the UI reaches the
API with no CORS and editorial data never leaves localhost.
"""
from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter, Response
from fastapi.responses import HTMLResponse, PlainTextResponse

router = APIRouter()

def _bundle_base() -> Path | None:
    """Root of a PyInstaller bundle's payload, or None when running from source.

    A frozen helper has no repo checkout around it: `dist/html` is bundled as
    data and lands under sys._MEIPASS, not three parents up from this file.
    """
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent))
    return None


_BUNDLE = _bundle_base()
_ROOT = _BUNDLE or Path(__file__).resolve().parent.parent.parent  # AE_Bridge/
DIST_HTML = _ROOT / "dist" / "html"
_LEGACY = Path(__file__).resolve().parent.parent / "ui" / "app.html"

# Public: ui_proxy.py applies this same policy to proxied HTML so the hosted
# and local paths enforce one policy, and so a hosted CSP that omits
# 'unsafe-eval' can't break the Nuxt 2 bundle that needs it.
CSP = (
    "default-src 'self'; "
    "connect-src 'self' http://127.0.0.1:8010 http://localhost:8010 "
    "http://127.0.0.1:4930 http://localhost:4930; "
    "img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    # The pre-Cloudflare Nuxt 2 release bundle contains runtime Function()
    # calls. This CSP is only served from the localhost helper, so retain the
    # compatibility permission needed by that original local build.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
)


def _nuxt_app_page() -> Path | None:
    candidate = DIST_HTML / "app" / "index.html"
    return candidate if candidate.is_file() else None


@router.get("/app", response_class=HTMLResponse)
def app_page() -> Response:
    page = _nuxt_app_page() or (_LEGACY if _LEGACY.is_file() else None)
    if page is None:
        return PlainTextResponse(
            "AEBridge UI not built. Run `yarn generate:release`.", status_code=404
        )
    return HTMLResponse(page.read_text(), headers={"Content-Security-Policy": CSP})
