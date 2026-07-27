# AEBridge — Build & Install

AEBridge is a **Nuxt 2 / Vue 2** panel (Node 16, Yarn) plus a **Python FastAPI**
helper, following the Elemental Bender architecture. It ships as a **thin
`.avpi`** (manifest + icon). In release the panel UI is served by the helper at
`http://localhost:8010/app`, same-origin with the `/v1` API — so editorial data
never leaves localhost and the manifest URL never changes (signed once).

Two independent delivery paths, same as EB: **UI** (Nuxt) and **helper** (Python).

## Prerequisites

- **Node 16** (`.nvmrc` pins 16.20.2) + **Yarn** for the panel UI.
- **Python 3** for the helper.

## Panel UI (Nuxt 2)

```bash
cd AE_Bridge
nvm use                 # Node 16.20.2
yarn install
yarn dev                # dev server on 127.0.0.1:3010 (hot reload)
```

In dev the manifest points at `localhost:3010/app` and the panel talks to the
helper on `8010` cross-origin.

## Build the .avpi (.mjs pipeline)

```bash
yarn build:panel          # dev profile   -> dist/AEBridge.avpi (url :3010/app)
yarn build:avpi:release   # release profile -> url :8010/app (helper serves UI)
yarn build:copy --run     # copy dist/AEBridge.avpi to Avid's PanelSDKPlugins
```

`build/manifest.mjs` writes `dist/app/avid-manifest.json` (+ icon from
`src/static/`); `build/zip.mjs` packages the thin `.avpi`.

## Release (helper serves the UI)

```bash
yarn generate:release      # static-export Nuxt to dist/html/
pip install -r requirements.txt
PYTHONPATH=. python -m service.app   # serves API + the built UI on 127.0.0.1:8010
```

The helper serves `dist/html` at `/app` (with a localhost-only CSP) and its
assets at `/_nuxt/*`. If `dist/html` doesn't exist yet, it falls back to the
lightweight `service/ui/app.html` so the panel still works.

Open `http://localhost:8010/app` to see the panel outside Avid.

## Install in Media Composer

1. `python build/build_avpi.py --install` (copies the `.avpi` to
   `/Library/Application Support/Avid/PanelSDKPlugins/`).
2. Make sure the helper is running on `8010`.
3. Restart Media Composer → **Tools → AEBridge**. A floating window opens the
   panel from `localhost:8010/app`.

An **unsigned** `.avpi` loads only on a developer machine. For distribution,
submit it to Avid's signing service (the manifest URL is stable, so it's signed
once). See the panel's `avid-panel-distribution` skill for the OTA/signing flow.

## What works today

- Helper boots, serves `/app` (with a localhost-only CSP) and `/v1/*`.
- **Real After Effects discovery** on macOS (`/v1/aebridge/ae` shows what it
  found / where it looked). The AE pill in the panel shows the version.
- **Real native `.aep` picker** (AppleScript) for existing-project mode.
- **Send actually launches After Effects** — builds/opens the comp via
  ExtendScript (`AfterFX -r`), sized to the shot, and leaves AE open to work in.
  A blank-comp option means Send works with no templates installed.
- Full round-trip state machine, path safety, and sidecar are real.

> **After changing helper code, restart the helper** (`Ctrl-C`, rerun
> `python -m service.app`). AE detection is cached at startup.

## Using it (Avid → After Effects)

1. Load a sequence in the Record monitor; mark **IN/OUT** around the shot. Add a
   **marker with a comment** in that range to name it.
2. In the panel, pick a **QuickTime** export setting (dropdown), choose project
   mode (new per shot, or add to an existing `.aep`), and hit **Send**.
3. AEBridge subclips the marked range, names it from the marker comment, exports
   the plate, and opens After Effects with a comp sized to the shot + the plate.

## What's stubbed (the remaining real-world seam)

- The **return trip**: a watch-folder loop (`rendering → returned`) that imports
  the AE render back into Avid and offers the swap. `integrations/mcapi.py`
  remains only as a dev fallback for running the panel outside Avid.

## If the panel says "After Effects not found"

1. Make sure the helper was restarted after the code update (detection is
   cached at startup).
2. Click the **"AE not found — why?"** pill: it lists exactly where the helper
   looked. Standard location is `/Applications/Adobe After Effects <year>/`.
3. If AE lives somewhere non-standard, tell me the path and I'll add it to
   discovery.

## Verify

```bash
PYTHONPATH=. python tests/test_smoke.py         # route contract + round-trip
PYTHONPATH=. python tests/test_ui_and_avpi.py   # served UI + packaged .avpi
```
