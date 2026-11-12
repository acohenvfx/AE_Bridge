# AEBridge — Build & Install

AEBridge is a **Nuxt 2 / Vue 2** panel (Node 22, Yarn) plus a **Python FastAPI**
helper, following the Elemental Bender architecture. It ships as a **thin
`.avpi`** (manifest + icon). In release the panel UI is served by the helper at
`http://localhost:8010/app`, same-origin with the `/v1` API — so editorial data
never leaves localhost and the manifest URL never changes (signed once).

Two independent delivery paths, same as EB: **UI** (Nuxt) and **helper** (Python).

## Prerequisites

- **Node 22** (`.nvmrc` pins 22.23.1) + **Yarn** for the panel UI.
- **Python 3** for the helper.

## Compatibility (Media Composer versions)

**RC1 minimum: Media Composer 2025.12.1.** This is the oldest version on which
AEBridge can keep every shipped feature, including reliable command automation
and per-track stacked-shot naming. The panel now reads `GetAppInfo` at startup
and exposes command-driven controls only when the host version supports them.
Any license tier is supported at this minimum. AEBridge is built and tested
against Panel SDK Drop 16, aligned with MC 2025.12.1.

Media Composer 2024.12 remains a useful best-effort diagnostic floor because it
has the newer Chromium 108 WebView and native Apple-Silicon support, but it is
not an RC1-supported configuration: command APIs and the exact marker response
needed by stacked naming are not consistently available there.

Requirements are tiered by which MCAPI calls each feature uses (source: Panel SDK
`releases.md`, drop → MC version):

- **Core round-trip calls first exist in MC 2024.2 and generally run on
  2024.12.** The pipeline depends on `CreateSubClip` (Drop 9 / MC 2024.2);
  everything else it uses predates that (`GetMobTrackInfo`, `ExportEDL`,
  `GetListOfExportSettings`, `GetMarkers`, `GetViewerMobs`, `ImportFile`,
  `SetMobInfo`). This does not make the complete RC1 feature set supported on
  those versions.
- **`DoCommand`-based features need MC 2025.6 (Drop 13), reliable at 2025.12
  (Drop 15).** `GetListOfCommands` / `IsCommandsEnabled` / `DoCommand` arrived in
  Drop 13 / MC 2025.6; below that they return "method not found," so the
  Diagnostics **auto-solo** and any command-driven track toggling don't exist
  on those hosts. AEBridge gates those controls using the host version returned
  by `GetAppInfo`.
  They only became reliable with `MakeWindowActive` in Drop 15 / MC 2025.12.
  The manual-solo path remains available as a fallback.
- **Per-track marker isolation — NEEDS VERIFICATION on 2024.12.** The
  `GetMarkers` track filter + `track_label` on the response — which makes a
  stacked shot take V1's marker comment, not a higher track's — is present in the
  Drop 16 proto but **not called out in any release note**, so its introduction
  version is unknown. If it postdates 2024.12, stacked-shot naming there falls
  back to the nearest-marker heuristic without track isolation (the bug fixed on
  2025.12.1). **Test stacked-shot naming on a real 2024.12 box before committing
  to it as the floor.** Correct stacked naming is confirmed only on 2025.12.1.
- **Minor Drop 16 conveniences (MC 2025.12.1).** `ExportFile`/`ImportFile`
  using current-or-default settings when none are provided (only matters if you
  Send with no export setting chosen); `GetViewerMobs` returning bin-loaded mob
  ids; `GetListOfBinItems` absolute+relative path support (24.12.6). AEBridge
  already probes multiple bin-path spellings and normally passes an explicit
  export setting, so these rarely bite.

**Net:** RC1 supports **Media Composer 2025.12.1 and newer**. Earlier versions
may load the stable AVPI and some core calls may work, but they are explicitly
outside the no-feature-loss support claim. The absolute floor for any Avid
panel to load at all is MC 2023.8 (`faq.md`).

## Panel UI (Nuxt 2)

```bash
cd AE_Bridge
nvm use                 # Node 22.23.1
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
yarn check:release-bundle  # reject source maps, local paths, and secret material
pip install -r requirements-lock.txt
PYTHONPATH=. python3 -m service.app  # serves API + the built UI on 127.0.0.1:8010
```

The shipped product does not run a Nuxt or Node server. Nuxt is a build-only
dependency that emits the static panel files embedded in the helper. The
release workflow audits the production dependency graph, scans the generated
bundle, and builds from the checked-in lockfile. Nuxt 2 itself is end-of-life;
its remaining audit findings are confined to generator/dev-server utilities
that are not copied into the installer. Migrating the panel build to a current
Vue/Vite stack remains tracked release engineering work, not a hidden RC1
runtime dependency.

For a signed installer, publish the dual-architecture helper first and stage
that exact immutable version before building the DMG:

```bash
bash ota/stage-helper-seeds.sh 1.0.0
bash installer/make-dmg.sh
```

The installer contains separate signed arm64 and x86_64 seeds and chooses from
the Mac's physical architecture, even if the installer itself was launched
under Rosetta. It verifies architecture, code signature, and Team ID both
before and after copying the helper.

The DMG also ships the user manual, `Assets/AE_Bridge_User_Guide.pdf`, as
"AE Bridge User Guide.pdf" next to the installer. The build stops if the PDF
is missing; set `AEBRIDGE_USER_GUIDE=/path/to/guide.pdf` to use another copy.

The helper serves `dist/html` at `/app` (with a localhost-only CSP) and its
assets at `/_nuxt/*`. If `dist/html` doesn't exist yet, it falls back to the
lightweight `service/ui/app.html` so the panel still works.

Open `http://localhost:8010/app` to see the panel outside Avid.

## Install in Media Composer

1. `python3 build/build_avpi.py --install` (copies the `.avpi` to
   `/Library/Application Support/Avid/PanelSDKPlugins/`).
2. Make sure the helper is running on `8010`.
3. Fully quit and reopen Media Composer → **Tools → AEBridge**. Closing a
   project or window is not sufficient because Avid discovers new panels only
   at application launch. The packaged installer handles this quit/reopen flow
   and offers an **Open Avid** button; restarting the Mac is not required.

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
> `python3 -m service.app`). AE detection is cached at startup.

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
PYTHONPATH=. python3 tests/test_smoke.py        # route contract + round-trip
PYTHONPATH=. python3 tests/test_ui_and_avpi.py  # served UI + packaged .avpi
```
