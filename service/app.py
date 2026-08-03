"""AEBridge helper — FastAPI app.

Standalone product; own helper on its own port (config.HELPER_PORT, default
8010), independent of Elemental Bender's 8000 helper. No ElementalEngine.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import DEV_ORIGINS, settings
from .integrations import ae
from .routers import aebridge, ui, version
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

# API routers first so /v1 routes remain local and protected from the UI proxy.
app.include_router(version.router)
app.include_router(aebridge.router)


@app.on_event("startup")
def _startup() -> None:
    settings.roots.ensure()
    settings.ae_version = ae.detect_ae_version()
    watcher.start()  # watch for AE renders coming back


@app.on_event("shutdown")
def _shutdown() -> None:
    watcher.stop()


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True, "ae": settings.ae_version}


# UI catch-all LAST — API and readiness routes above always win. In production
# this proxies the Cloudflare Worker through localhost; in development it can serve
# dist/html locally with AEBRIDGE_SERVE_LOCAL_UI=1.
app.include_router(ui.router)


def main() -> None:
    import uvicorn

    from .config import HELPER_HOST, HELPER_PORT

    uvicorn.run(app, host=HELPER_HOST, port=HELPER_PORT)


if __name__ == "__main__":
    main()
