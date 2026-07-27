# AEBridge

One-click round-trip between Avid Media Composer and After Effects for temp
titles, graphics, and quick element comps. Select a shot, send a reference
movie + frame range + data sidecar out into a pre-built `.aep` template with the
plate already on the timeline; the editor works in AE and renders to a watched
folder; AEBridge auto-imports the finished QuickTime and offers to link-and-swap
it into the record sequence at the exact timecode.

This folder is the **home for all AEBridge material** — specs, prototypes,
`.aep` templates, helper endpoint code, and notes. Nothing AEBridge-related
belongs in the `ElementalBender_Panel` repo until it ships as a real panel
feature.

## Where AEBridge fits

AEBridge is a **standalone product**, separate from Elemental Bender. It follows
the same proven architecture *pattern* (see
`../ElementalBender_Panel/docs/TOOL_ARCHITECTURE_AND_SECURITY_STANDARD.md`) but
has its own stack — its own AVPI, UI, and helper on its own port. It does **not**
use EB's helper, EB's port, or ElementalEngine. In short:

- **Panel UI (Nuxt/Vue):** controls, status, and the **MCAPI calls** (the Avid
  gateway/token are injected into the panel WebView, so timeline access runs
  client-side — read the shot, subclip from marks, rename, export).
- **AEBridge Helper (`127.0.0.1:8010`):** owns the local side — path-safe export
  dirs, the sidecar, `.aep` templating, After Effects discovery + launch, and
  (soon) the return watch-folder + import. Runs alongside EB's `8000` helper,
  fully separate.
- **Data stays on the Mac.** The round-trip is entirely local; no network
  needed.

## How the grab works (Avid → After Effects)

1. Editor marks **IN/OUT** around a shot on the record timeline (a marker with a
   comment names it).
2. Panel `CreateSubClip(use_marks_bounds)` turns the marked range into a new
   sequence in an `AEBridge_Temps` bin; the subclip + sequence are renamed to the
   marker comment.
3. Helper `/prepare` hands back a path-safe export dir on the Desktop; the panel
   `ExportFile`s the shot there as a QuickTime (named after the shot).
4. Helper waits until the export is fully written, builds an AE comp sized to the
   shot with the plate imported, and launches After Effects on it.

## Stack

Follows the Elemental Bender architecture: **Nuxt 2 / Vue 2** panel UI (Node 16,
Yarn) + **Python FastAPI** helper, thin `.avpi`, helper-served UI in release.
Standalone from EB — own helper port (`8010`), no ElementalEngine.

## Contents

- `docs/AEBRIDGE_DESIGN.md` — helper-side design spec and route contract.
- `docs/BUILD_AND_INSTALL.md` — Nuxt build, helper, `.avpi`, install in Avid.
- `src/` — Nuxt 2 panel (pages, `components/AEBridgePanel.vue`, EB `style.scss`,
  mixin, store, `utils/api/`).
- `service/` — FastAPI helper (API + serves the panel at `/app`). See `service/README.md`.
- `build/*.mjs` — manifest + zip + panel + copy pipeline.
- `tests/` — route/round-trip smoke tests + UI/AVPI checks.
- `dist/` — build output (`html/` Nuxt export, `app/` manifest, `AEBridge.avpi`).

## Quick start

```bash
# Panel UI (Node 16)
nvm use && yarn install
yarn dev                     # http://127.0.0.1:3010/app  (hot reload)

# Helper (separate terminal)
pip install -r requirements.txt
PYTHONPATH=. python -m service.app   # API on 127.0.0.1:8010

# Package the panel
yarn build:avpi:release      # -> dist/AEBridge.avpi (release: helper serves UI)
```

## Status

**Full round-trip works.**

- **Out (Avid → AE):** mark a shot, Send → subclip-from-marks, marker-comment
  naming, QuickTime export, After Effects opens a correctly-sized comp with the
  plate. The comp is pre-queued to render into the job's watch folder.
- **Back (AE → Avid):** the editor renders the queued comp; the helper's
  watch-folder loop detects the finished render and flips the job to
  `returned`; the panel shows **Import to Avid** and does the MCAPI `ImportFile`
  into an `AEBridge_Returns` bin.

Real on macOS: MCAPI grab + import, ExtendScript comp build + render-queue
setup + AE launch, native `.aep` picker, path-safe export/watch dirs,
export- and render-completion waiting.

**Next:** auto **link-and-swap** the return into the record sequence at the
shot's TC (currently it imports to a bin and the editor cuts it in), and
`ffprobe` validation of the return against the sidecar.

See `docs/BUILD_AND_INSTALL.md` to build/run and `docs/AEBRIDGE_DESIGN.md` for
the route contract.
