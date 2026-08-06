"""Serve the panel UI from the helper, proxying a hosted build (OTA updates).

Why proxy instead of pointing the panel's manifest at the hosted URL:

- **The manifest is SIGNED.** `url` and `allowedDomains` live inside it, so
  every change to either means going back to Avid for re-signing. Keeping the
  panel on `http://localhost:8010/app` means the hosted UI can be republished
  as often as you like and the manifest never changes.
- **An HTTPS page cannot call `http://127.0.0.1:8010`** — mixed content. This
  is not theoretical; DifferenceEngine's `service/ui_proxy.py` documents
  hitting exactly this wall, which is why it proxies too.
- A public-origin page calling localhost also trips **Private Network Access**
  preflights the helper does not answer, and would be **cross-origin with
  /v1** (CORS).

Proxied, Avid's WebView only ever sees `http://localhost:8010`, so the UI is
same-origin with the API and none of the above applies.

**Which hostname to point at.** It must be an origin that does NOT sit behind
Cloudflare's browser verification. `aebridge.andrewcoheneditor.com` injects
`/cdn-cgi/challenge-platform/...`, which Avid's embedded WebView cannot
complete (verified 2026-08-05 by fetching it) — the same trap DifferenceEngine
records for its own custom domain. Use the direct `*.workers.dev` hostname
instead. AEBridge is a Worker (with a static Assets binding), not a Pages
project, so its direct hostname is `ae-bridge.<subdomain>.workers.dev`. The
workers.dev route was disabled by default (404s) until confirmed live and
serving the current Git-connected build 2026-08-06 — `ota/AEBridgeLauncher.sh`
now defaults `AEBRIDGE_UI_ORIGIN` to this hostname.

**This module's own default is OFF.** With `AEBRIDGE_UI_ORIGIN` unset — e.g.
running `service.app` directly, outside the launcher — the helper serves the
local `dist/html` build exactly as it always has (see `ui.py`).
`ota/AEBridgeLauncher.sh` is what turns it ON for a real install, by exporting
`AEBRIDGE_UI_ORIGIN` itself before exec'ing the helper.
"""
from __future__ import annotations

import os

import httpx
from fastapi import APIRouter, HTTPException, Request, Response

from .ui import CSP

router = APIRouter()

# The direct, challenge-free hostname to switch to once the workers.dev route
# is enabled and the Cloudflare build is green. Not used unless
# AEBRIDGE_UI_ORIGIN is set — this is documentation, not a default.
SUGGESTED_ORIGIN = "https://ae-bridge.andrewcohenvfx.workers.dev"

UI_ORIGIN = os.environ.get("AEBRIDGE_UI_ORIGIN", "").strip().rstrip("/")

# Namespaces the proxy must never swallow. The catch-all is registered last so
# real routes win anyway, but a stray match here would silently send API calls
# to the hosted origin, so refuse them explicitly.
_LOCAL_ONLY_PREFIXES = ("v1", "healthz")

# Upstream response headers that must not be copied verbatim.
#   content-encoding / content-length: we request identity and re-send our own
#     body, so the upstream values would contradict the bytes.
#   transfer-encoding / connection: hop-by-hop.
#   HSTS: would pin localhost to HTTPS, which the helper does not speak.
#   CSP: replaced with the panel's own (see ui.py) so proxied and local modes
#     enforce the same policy — and so a hosted CSP missing 'unsafe-eval'
#     cannot break the Nuxt 2 bundle, which needs it.
_SKIP_RESPONSE_HEADERS = frozenset(
    {
        "content-encoding",
        "transfer-encoding",
        "connection",
        "content-length",
        "strict-transport-security",
        "content-security-policy",
        "content-security-policy-report-only",
    }
)

# Request headers that belong to the localhost hop, not the upstream one.
_SKIP_REQUEST_HEADERS = frozenset({"host", "content-length", "connection"})

_http_client = httpx.AsyncClient(follow_redirects=True, timeout=20.0)


def is_local_only(path: str) -> bool:
    """True for paths the proxy must leave to the helper's own routers."""
    head = (path or "").lstrip("/").split("/", 1)[0]
    return head in _LOCAL_ONLY_PREFIXES


def filter_request_headers(headers: dict[str, str]) -> dict[str, str]:
    """Headers to forward upstream.

    Avid's WebView advertises Brotli, but this proxy strips Content-Encoding
    from the response — so force `identity` and keep bytes and headers in
    agreement rather than relying on the client to decode.
    """
    out = {k: v for k, v in headers.items() if k.lower() not in _SKIP_REQUEST_HEADERS}
    out["accept-encoding"] = "identity"
    return out


def filter_response_headers(headers: dict[str, str], *, is_html: bool) -> dict[str, str]:
    """Headers to pass back, with the panel's own CSP on HTML."""
    out = {k: v for k, v in headers.items() if k.lower() not in _SKIP_RESPONSE_HEADERS}
    if is_html:
        out["Content-Security-Policy"] = CSP
    return out


@router.api_route(
    "/{path:path}",
    methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def ui_proxy(path: str, request: Request) -> Response:
    if is_local_only(path):
        raise HTTPException(status_code=404, detail="Not found")

    url = f"{UI_ORIGIN}/{path}"
    try:
        # Forward the method and body, not just GET: a hosted origin can put
        # verification or form endpoints behind POST.
        upstream = await _http_client.request(
            request.method,
            url,
            params=dict(request.query_params),
            content=await request.body(),
            headers=filter_request_headers(dict(request.headers)),
        )
    except httpx.HTTPError as exc:
        # Say where it was pointed — a stale AEBRIDGE_UI_ORIGIN otherwise looks
        # like the helper itself is broken.
        raise HTTPException(
            status_code=502,
            detail=f"Panel UI is hosted at {UI_ORIGIN} and could not be reached: {exc}",
        ) from exc

    content_type = upstream.headers.get("content-type", "")
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=filter_response_headers(
            dict(upstream.headers), is_html="text/html" in content_type.lower()
        ),
        media_type=content_type or None,
    )
