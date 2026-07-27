# AEBridge — Agent Handoff

Context for the next agent/session continuing AEBridge. Read this + the docs it
points to before touching code.

## What AEBridge is

A standalone Avid Media Composer ↔ After Effects round-trip panel for VFX temp
plates. Editor marks a shot on the record timeline → AEBridge exports the plate
and opens an AE comp with it → editor renders → AEBridge imports the render back
into the same bin. Follows the Elemental Bender architecture but is its **own**
product (own helper port, no ElementalEngine).

- Repo: this folder (`AE_Bridge`), git remote `acohenvfx/AE_Bridge`.
- Stack: **Nuxt 2 / Vue 2** panel (Node 16, Yarn) + **Python FastAPI** helper.
- Read next: `docs/AEBRIDGE_DESIGN.md` (route contract + as-built),
  `docs/BUILD_AND_INSTALL.md` (run/build), `docs/PHASE_MULTIPLATE.md` (current
  phase). The `avid-panel-dev` skill covers the EB stack conventions.

## Hard-won architecture facts (do not relearn the slow way)

- **MCAPI runs in the PANEL (WebView), not the helper.** Avid injects the
  gateway + token into the panel only. All timeline/MCAPI work is in
  `src/utils/api/timeline.js`. The helper does filesystem/AE/paths.
- **gRPC-Web plumbing** was copied from the EB project into
  `src/utils/{proto,grpc-web}` + `src/utils/api/mcapi.js`. Verify every
  generated getter name against the stubs before using (several differ from the
  proto field name, e.g. FrameRate is `getNum/getDen`).
- **Helper does NOT hot-reload** — restart `python -m service.app` after any
  `service/**` change. The panel (`yarn dev`, port **3010**) hot-reloads.
- **Ports:** helper `127.0.0.1:8010`; dev panel `127.0.0.1:3010` (CORS allowed).
  Release = helper serves the generated Nuxt build at `8010/app`.
- **Marks are NOT readable via MCAPI.** No mark IN/OUT key; `GetValues` is
  test-only; `ExportEDL` ignores marks. To limit to the marked range we create a
  marks-bounded subclip (MC applies marks internally) and derive the range from
  it — see `timeline.js` `getMarkedTrackClips` + `deriveMarkedRange`.
- **No delete-mob API.** Scratch subclips can't be programmatically deleted; we
  isolate them in an `AEBridge_Scratch` bin.
- **CreateSubClip quirks:** `head_frame/end_frame` default to 0 and override
  `use_marks_bounds` — set them to **-1**. `create_new_sequence=true` wraps the
  marked range in one sequence (correct single export target) and its subclips
  still reference the SOURCE master clips, so `add_frames_at_head/end` = handles
  pulls **source** media. `create_new_sequence=false` emits one subclip per
  source clip (used for enumeration, not for the normal export).
- **Bin paths** are picky — probe `Name.avb` / `Name` / absolute; create/open
  the bin first (`ensureBin` / `resolveBinPath`).
- **Export is async** — MC's `ExportFile` RPC returns before the file is
  flushed. The helper waits for a size-stable file (`_resolve_exported_reference`).
- **AE launch** via AppleScript `DoScriptFile` (not `AfterFX -r`, which stalls on
  the Home screen). Comp duration is set from the imported plate (Avid frame-count
  columns are unreliable).

## Working end to end (single-plate)

Grab (mark → `CreateSubClip(use_marks_bounds)` → marker-comment rename of subclip
+ sequence → export opaque plate) → AE opens a correctly-sized comp with the
plate → editor renders into the job's `RENDER/` folder → helper watch-folder
flips job to `returned` → panel **Import to Avid** does `ImportFile` back into
the export bin. Handle padding pulls source media. Folders:
`~/Desktop/AEBridge/exports/<YYYYMMDD>_<shot>/{PLATE,RENDER}`.

Panel UX done: name prefix/suffix, auto-refresh shot readout, remembered export
setting/prefix/suffix/mode, new-project Save-As dialog, Clear-finished jobs.

## Current phase: multi-plate / multi-track (see PHASE_MULTIPLATE.md)

Model (locked with the user): a marked range splits into **one temp per V1
clip**; each temp = the V1 clip + the clips above it on enabled tracks, stacked
as layers in **one comp per V1 clip**. Naming: V1 = `<marker>`, tracks above =
`<marker>_pl02`, `_pl03` (editable per track). All plates **opaque** (DNx36,
QuickTime-wrapped so AE imports). Enabled/selected tracks only. Per-cut split:
yes (each V1 clip is its own temp).

### Done in this phase (4a — enumeration), NOT yet tested in Avid
- Helper: `service/edl.py` CMX3600 parser + `POST /v1/aebridge/parse-edl`
  (reads the EDL MC writes, returns clip events; optional range filter). Unit
  tested.
- Panel: `getMobTrackInfo`, `videoTracks`, `exportEdlForTrack`,
  `getMarkedTrackClips`, `deriveMarkedRange` in `timeline.js`; `parseEdl` in
  `utils/api/aebridge.js`; **"Analyze V1 clips"** button + a Track/Clip/RecIn/
  RecOut table in the panel. It derives the marked range (marks-subclip on V1 →
  match to V1 EDL → record range) and filters every enabled video track to it.
- `deriveMarkedRange` verified pure-fn in the sandbox. Everything MCAPI-facing is
  UNVERIFIED in Avid.

### Immediate next step
User needs to test **Analyze** on a real multi-clip / multi-track timeline and
report: (1) is the table limited to the marked range with correct range shown,
(2) Track column correct, (3) `AEBridge_Scratch` bin created. Then iterate on the
name/TC matching in `deriveMarkedRange` if the range is wrong (verbose log key:
`marked V1 clips`; enable via `localStorage.setItem('aebridge.verboseMcapiLogging','1')`).

### Then 4b → 4d
- **4b:** for each V1 clip in range, `CreateSubClip(head_timecode/end_timecode,
  track_list=[track])` per enabled track over that clip's record span → per-group
  opaque plates named `_plNN`; `prepare_comp` builds a layered comp from a
  `plates[]` list (extend `SendRequest`/`Sidecar`). One **Send** fans out to **N
  jobs** (one per V1 clip) — each reuses the existing single-shot pipeline.
- **4c:** panel plan-preview with editable plate names + batch Send + N job rows.
- **4d:** empty-track handling, naming edge cases, scratch-bin cleanup (maybe via
  `DoCommand`), `ffprobe` return validation.

## How to run / test

```bash
# panel (Node 16)
nvm use && yarn install && yarn dev        # 127.0.0.1:3010/app
# helper (restart after any service/** change)
PYTHONPATH=. python -m service.app         # 127.0.0.1:8010
# sandbox checks
PYTHONPATH=. python tests/test_smoke.py
PYTHONPATH=. python tests/test_ui_and_avpi.py
# JS syntax (no Avid needed): node --check on a copied .mjs
```
MCAPI-dependent code can only be verified inside Media Composer (the `mcapi`
global exists only in the Avid WebView). Build to the EB patterns, add verbose
logging, and iterate with the user on real Avid results.

## Git / gotchas

- Committing from a sandbox on the virtio-fs mount leaves stale `.git/*.lock`
  files that jam the user's Mac git. **Do git on the user's Mac**, not in the
  sandbox. If locks appear: `find .git -name '*.lock' -delete`.
- Last commit before this handoff: `8f0016a` (return-to-bin + source handles +
  PLATE/RENDER + panel UX). The 4a EDL work + this handoff are uncommitted.
- Push needs the user's credentials (none in sandbox).

## Uncommitted at handoff
`service/edl.py`, `service/models.py`, `service/routers/aebridge.py`,
`src/utils/api/timeline.js`, `src/utils/api/aebridge.js`,
`src/components/AEBridgePanel.vue`, `docs/PHASE_MULTIPLATE.md`, this file.
