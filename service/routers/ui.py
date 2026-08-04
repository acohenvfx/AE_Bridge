"""Serve the panel UI through the local helper, same-origin with its API.

In production the helper proxies the static panel from the AEBridge Cloudflare
Worker. This keeps the signed AVPI pointed at ``http://localhost:8010/app`` while allowing
panel changes to ship over the air. The helper never proxies the versioned API
or any user media path.

Set ``AEBRIDGE_SERVE_LOCAL_UI=1`` to serve ``dist/html`` while developing or
before the first Worker deployment. Set ``AEBRIDGE_DEV=1`` to proxy the Nuxt
dev server instead.
"""
from __future__ import annotations

import os
import time
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import FileResponse

router = APIRouter()

_ROOT = Path(__file__).resolve().parents[2]  # AE_Bridge/
_LOCAL_UI_ROOT = _ROOT / "dist" / "html"
_LEGACY_UI = _ROOT / "service" / "ui" / "app.html"

_default_origin = "https://aebridge.andrewcoheneditor.com"
if os.environ.get("AEBRIDGE_DEV") == "1":
    _default_origin = "http://127.0.0.1:3010"
UI_ORIGIN = os.environ.get("AEBRIDGE_UI_ORIGIN", _default_origin).rstrip("/")
# Keep one stable cache-buster for all versioned assets during a helper
# session. A new helper process gets a new key, so a freshly deployed Worker
# cannot be hidden behind an older cached HTML fallback at the edge.
_UI_CACHE_KEY = os.environ.get("AEBRIDGE_UI_CACHE_KEY", str(int(time.time())))

# Reuse connections and TLS sessions across proxied asset requests.
_http_client = httpx.AsyncClient(follow_redirects=True, timeout=20.0)

_SKIP_RESPONSE_HEADERS = {
    "content-encoding",
    "transfer-encoding",
    "connection",
    "content-length",
    "strict-transport-security",
    "content-security-policy",
    "content-security-policy-report-only",
    "set-cookie",
}

_CSP = (
    "default-src 'self'; "
    "connect-src 'self' http://127.0.0.1:8010 http://localhost:8010 "
    "http://127.0.0.1:4930 http://localhost:4930; "
    "img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "script-src 'self' 'unsafe-inline'"
)


def _local_ui_enabled() -> bool:
    return os.environ.get("AEBRIDGE_SERVE_LOCAL_UI") == "1"


def _local_ui_file(path: str) -> Path | None:
    """Resolve a static UI path without allowing traversal outside dist/html."""
    rel = (path or "").lstrip("/")
    root = _LOCAL_UI_ROOT.resolve()

    candidates: list[Path] = []
    if not rel or rel.endswith("/"):
        candidates.extend(
            [
                root / rel / "index.html",
                root / rel / "200.html",
                root / "index.html",
                root / "200.html",
            ]
        )
    else:
        candidate = (root / rel).resolve()
        if candidate.is_dir():
            candidates.extend([candidate / "index.html", candidate / "200.html"])
        candidates.append(candidate)
        # Only the known application routes may use the SPA shell fallback.
        # Missing /_nuxt assets must remain missing instead of being returned
        # as text/html, which Chromium rejects as a ChunkLoadError.
        if rel.strip("/") in {"", "app"}:
            candidates.append(root / "200.html")

    for candidate in candidates:
        try:
            candidate.relative_to(root)
        except ValueError:
            continue
        if candidate.is_file():
            return candidate
    return None


def _serve_local_ui(path: str) -> FileResponse:
    target = _local_ui_file(path)
    if target is None and path.strip("/") in {"", "app"} and _LEGACY_UI.is_file():
        target = _LEGACY_UI
    if target is None:
        raise HTTPException(status_code=404, detail="Local UI file not found")
    media = "text/html" if target.suffix == ".html" else None
    return FileResponse(
        str(target),
        media_type=media,
        headers={"Content-Security-Policy": _CSP},
    )


@router.api_route(
    "/{path:path}",
    methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def ui_proxy(path: str, request: Request):
    # These namespaces belong to the local helper and must never be forwarded
    # to a public UI host. The explicit health/docs exclusions also make this
    # catch-all safe if FastAPI route ordering changes later.
    if (
        path == "v1"
        or path.startswith("v1/")
        or path == "api"
        or path.startswith("api/")
        or path in {"healthz", "openapi.json", "docs", "redoc"}
    ):
        raise HTTPException(status_code=404, detail="Not found")

    if _local_ui_enabled():
        return _serve_local_ui(path)

    url = f"{UI_ORIGIN}/{path}"
    try:
        # Do not forward Host or connection-specific headers from localhost.
        # Request identity encoding so response bytes match headers after the
        # proxy removes upstream content-encoding metadata.
        headers = {
            key: value
            for key, value in request.headers.items()
            if key.lower() not in {"host", "content-length", "connection"}
        }
        headers["accept-encoding"] = "identity"
        params = dict(request.query_params)
        if path in {"app", "app/"}:
            # The HTML shell changes whenever a deployment changes hashed
            # asset names. Keep the local AVPI from reusing an older edge copy.
            params["_aebridge"] = _UI_CACHE_KEY
        elif path.startswith("_nuxt/"):
            # Cloudflare's SPA fallback can otherwise be cached for a newly
            # deployed chunk and come back as HTML with a 200 status.
            params["_aebridge"] = _UI_CACHE_KEY

        upstream = await _http_client.request(
            request.method,
            url,
            params=params,
            content=await request.body(),
            headers=headers,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Panel UI is hosted at {UI_ORIGIN} and could not be reached: {exc}",
        ) from exc

    headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() not in _SKIP_RESPONSE_HEADERS
    }
    headers["Content-Security-Policy"] = _CSP
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=headers,
        media_type=upstream.headers.get("content-type"),
    )
