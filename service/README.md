# AEBridge Helper (prototype)

Standalone FastAPI helper for the Avid ↔ After Effects round-trip. Runs on its
own port (`127.0.0.1:8010` by default), separate from Elemental Bender's `8000`
helper. No ElementalEngine.

## Layout

```
service/
  app.py                 FastAPI app, startup, /healthz
  config.py              port + allowed roots (env-overridable)
  paths.py               allowed-root path safety
  models.py              Pydantic schemas + sidecar
  jobs.py                job store, state machine, opaque project tokens
  routers/
    version.py           /v1/version (feature detection)
    aebridge.py          /v1/aebridge/* route contract
    ui.py                localhost UI proxy + local development fallback
  integrations/
    mcapi.py             Avid MCAPI seam (stubbed — returns fake shot data)
    ae.py                After Effects seam (discovery, comp build, stability)
```

The stubs in `integrations/` are the only things that need real wiring; every
route, schema, path check, and the job state machine are real.

## Run

```bash
pip install -r ../requirements.txt
PYTHONPATH=.. python -m service.app        # serves on 127.0.0.1:8010
# or: PYTHONPATH=.. uvicorn service.app:app --port 8010
```

## Test

```bash
PYTHONPATH=. python tests/test_smoke.py    # exercises the full round-trip
```

Covers: version/feature detection, template listing, the new-per-shot
round-trip through swap, the existing-project token flow, and rejection of a
bad picker selection.

## Config (env vars)

| Var | Default |
| --- | --- |
| `AEBRIDGE_PORT` | `8010` |
| `AEBRIDGE_UI_ORIGIN` | `https://aebridge.andrewcoheneditor.com` |
| `AEBRIDGE_SERVE_LOCAL_UI` | unset; set to `1` for a local generated UI |
| `AEBRIDGE_DEV` | unset; set to `1` to proxy Nuxt on `127.0.0.1:3010` |
| `AEBRIDGE_HOME` | `~/Library/Application Support/AEBridge` |
| `AEBRIDGE_EXPORT_ROOT` / `WATCH_ROOT` / `TEMPLATE_ROOT` / `AEP_WORK_ROOT` | under `AEBRIDGE_HOME` |

## Real on macOS now

- AE discovery + version (`integrations/ae.py`, `find_ae`) — see `GET /v1/aebridge/ae`.
- Native `.aep` picker (`integrations/macos.py`, AppleScript).
- Send builds the comp via ExtendScript and launches AE (`AfterFX -r`).
- ffmpeg placeholder plate so the AE side is real before MCAPI is wired.

## MCAPI runs in the panel

Avid injects the gateway/token into the panel WebView, so the timeline grab +
export run client-side (`src/utils/api/timeline.js`), and the panel hands the
helper the shot metadata + exported reference via `/prepare` + `/send`.
`integrations/mcapi.py` is only a dev fallback for running outside Avid.

## Not yet wired

- Watch-folder loop that flips a job `rendering → returned` on a stable file.
- `ffprobe`-based return validation against the sidecar; `/return/*` import+swap
  against live Avid.

## Cloudflare Worker

The production helper keeps the signed AVPI on `http://localhost:8010/app` and
proxies only the static panel UI from `AEBRIDGE_UI_ORIGIN`. The versioned API,
editorial metadata, footage, and renders remain local. See
`docs/CLOUDFLARE_DEPLOY.md` for the Worker workflow and installer environment.
