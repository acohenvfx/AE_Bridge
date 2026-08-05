"""AEBridge helper — FastAPI app.

Standalone product; own helper on its own port (config.HELPER_PORT, default
8010), independent of Elemental Bender's 8000 helper. No ElementalEngine.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import DEV_ORIGINS, settings
from .integrations import ae
from .routers import aebridge, ui, ui_proxy, version
from .routers.ui import DIST_HTML
from .watcher import watcher

app = FastAPI(title="AEBridge Helper", version="0.0.1")

# In release the panel is served BY the helper (same-origin, no CORS needed).
# In dev the Nuxt panel runs on :3010 and calls the helper cross-origin, so
# allow the dev origins explicitly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers first so /v1, /app, /healthz always win over the static mount.
app.include_router(version.router)
app.include_router(aebridge.router)
# Local UI and hosted-UI proxy are mutually exclusive: the proxy is a catch-all
# and would otherwise shadow (or be shadowed by) the local /app route. With
# AEBRIDGE_UI_ORIGIN unset this is exactly the old behaviour.
if not ui_proxy.UI_ORIGIN:
    app.include_router(ui.router)


@app.on_event("startup")
def _startup() -> None:
    settings.roots.ensure()
    settings.ae_version = ae.detect_ae_version()
    watcher.start()  # watch for AE renders coming back


@app.on_event("shutdown")
def _shutdown() -> None:
    watcher.stop()


# Serve the generated Nuxt export (assets like /_nuxt/*, "/") if it exists.
# Mounted LAST — lowest routing priority — per the EB secure-runtime pattern.
# Skipped when proxying: the hosted origin serves its own assets.
if not ui_proxy.UI_ORIGIN and DIST_HTML.is_dir():
    app.mount("/", StaticFiles(directory=str(DIST_HTML), html=True), name="ui")


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True, "ae": settings.ae_version}


# The hosted-UI proxy is a catch-all, so it must be registered after every real
# route — including /healthz above — or it would swallow them. It also refuses
# the API namespaces itself (see is_local_only), belt and braces.
if ui_proxy.UI_ORIGIN:
    app.include_router(ui_proxy.router)


def main() -> None:
    import uvicorn

    from .config import HELPER_HOST, HELPER_PORT

    uvicorn.run(app, host=HELPER_HOST, port=HELPER_PORT)


if __name__ == "__main__":
    main()
