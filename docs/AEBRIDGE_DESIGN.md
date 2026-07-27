# AEBridge — Design Spec

Helper-side design for the Avid ↔ After Effects round-trip.

**AEBridge is a standalone product**, separate from Elemental Bender. It *follows
the same architecture pattern* documented in
`ElementalBender_Panel/docs/TOOL_ARCHITECTURE_AND_SECURITY_STANDARD.md` — thin
certified AVPI, a local helper, a hosted static UI, allowed-root path checks,
versioned `/v1/` routes, and local-only editorial data — but it does **not**
share Elemental Bender's helper, port, UI, or engine:

- **Own helper on its own port.** AEBridge's helper listens on
  `127.0.0.1:8010` (placeholder — any free port that is *not* EB's `8000`). The
  two helpers run side by side and never talk to each other.
- **No ElementalEngine.** ElementalEngine is Elemental Bender's signed engine
  for EB's proprietary algorithms. AEBridge does not use it. The round-trip is
  orchestration + file I/O; anything proprietary AEBridge needs later lives in
  its own helper/engine, not EB's.

Status: design / pre-implementation.

---

## 1. What AEBridge does

An editor selects a shot in a record sequence and hits **Send to AE**. AEBridge:

1. Reads the shot's metadata and exports a reference movie for its frame range.
2. Writes a data sidecar (shot name, source/record TC, rate, resolution,
   handles, version) next to the reference.
3. Builds the AE comp for the shot — either as a **new project** from the
   template, or as a **new comp added to an existing project** the editor picks
   — imports the reference plate onto its timeline, and opens it (or leaves it
   for the editor to open). See §5a Project mode.
4. The editor works in After Effects and renders to a **watched folder**.
5. AEBridge detects the finished QuickTime, validates it against the sidecar,
   imports it into Avid, and **offers** to link-and-swap it into the record
   sequence at the exact record TC.
6. A version stamp is written back so naming/versioning stays consistent both
   directions.

Design principle: **the panel nudges, it never silently rewrites the cut.**
Step 5 defaults to *offer* (drop into a bin, flag it, one-click insert), not
automatic overwrite. Auto-swap is opt-in per job.

---

## 2. Boundary mapping

AEBridge has its **own** three-layer stack, independent of Elemental Bender:

| Layer | AEBridge responsibility |
| --- | --- |
| **AEBridge AVPI** | AEBridge's own thin certified loader. Stable; not changed by routine updates. |
| **Panel UI (hosted static / Vue)** | Send button, job list, status polling, project-mode + bin/target prompts, "offer to swap" prompt, version display. **No** naming/comp/transform logic. |
| **AEBridge Helper (`127.0.0.1:8010`)** | Everything: MCAPI calls, reference export, sidecar, `.aep` templating, AE scripting / `aerender` orchestration, watch folder, return import, version stamp. Versioned `/v1/aebridge/*` routes. Runs alongside EB's `8000` helper, fully separate. |

No ElementalEngine and no shared EB helper. Ships via AEBridge's own signed
helper release + its own static UI deploy; order is fixed: helper first, verify
OTA, then UI.

---

## 3. Data policy (satisfied by design)

The entire round-trip is local: footage, the reference movie, the sidecar, the
`.aep`, and the render all stay on the Mac. AE runs locally. No step needs
network — and AEBridge's panel CSP locks the UI to its own localhost helper so
editorial data cannot be uploaded, exactly as the EB pattern requires.

---

## 4. Allowed-root path safety (critical)

AEBridge moves paths between Avid, the filesystem, and After Effects, so every
path that crosses `/v1/` must be validated against an **allowed-root allowlist**
held by the helper — never a raw path from the panel or a sidecar.

Configured roots (helper config, not panel-supplied):

- `export_root` — where reference movies + sidecars are written.
- `watch_root` — the folder(s) AE renders returns into.
- `template_root` — the `.aep` template library (read-only). **Distributed with
  the AEBridge helper runtime** (shipped and updated via the helper's signed
  release), not curated per machine — so every artist has the same templates
  and updates arrive with the helper.
- `aep_work_root` — where per-job `.aep` copies are created.

Rules:

- Reject any request path that does not resolve (after symlink + `..`
  normalization) under an allowed root.
- The panel never sends absolute paths for export/watch targets; it sends a
  **job id** and the helper derives paths from config.
- Returned QuickTimes are only accepted from inside `watch_root`.
- `.aep` templates are chosen by **id**, resolved against `template_root`.
- **Exception — editor-chosen target project:** in `existing_project` mode the
  editor picks an `.aep` via the helper's native dialog. That path is a
  deliberate user choice, so it may sit outside the configured roots, but it is
  normalized, re-validated at write time, referenced only via an opaque
  session token, and only ever appended to (a new comp) — never deleted or
  rewritten. Exports, sidecars, and renders remain under the configured roots.

---

## 5. `/v1/aebridge/*` route contract

All routes are versioned, schema-validated, limited, and covered by
success/failure tests, per the Local API Contract. Feature id:
`aebridge`, surfaced in `/v1/version`.

### `POST /v1/aebridge/send`

Start a round-trip for the currently selected shot.

Request:

```json
{
  "template_id": "lower_third_v2",
  "handles": 8,
  "auto_swap": false,
  "project_mode": "new_per_shot",
  "target_project_token": null
}
```

- `project_mode`: `"new_per_shot"` (default) or `"existing_project"`.
- `target_project_token`: required when `project_mode = "existing_project"`. It
  is **not** a path — it is an opaque token returned by
  `POST /v1/aebridge/pick-project` (see §5a). The panel never sends a raw
  `.aep` path.

The helper resolves the selected mob via MCAPI (it does **not** trust a
panel-supplied path). Response:

```json
{
  "job_id": "aeb_2026-07-22_A017C003_001",
  "state": "exporting",
  "project_mode": "new_per_shot",
  "reference_path": "<export_root>/aeb_…/ref.mov",
  "sidecar_path": "<export_root>/aeb_…/shot.json",
  "aep_path": "<aep_work_root>/aeb_…/comp.aep"
}
```

In `existing_project` mode, `aep_path` is the resolved target project and the
helper adds a **new comp** to it (named per shot) rather than creating a fresh
file.

### `POST /v1/aebridge/pick-project`

Used only for `existing_project` mode. VFX editors work one of two ways — a new
AE project per shot, or a single project holding all the temps they're working
on — so AEBridge asks up front and supports both.

The **helper** (not the panel) opens a native macOS open-file dialog scoped to
`.aep`, because dialogs are a helper responsibility and a browser page cannot
open a real file picker over localhost. The user's selection is an explicit,
user-authorized action; the helper normalizes it (resolve symlinks, reject
`..`), confirms it is a readable `.aep`, and returns an opaque token plus a
display label:

```json
{ "target_project_token": "proj_9f3a…", "label": "Reel2_Temps.aep" }
```

The panel shows the label and passes the token back to `POST /send`. The token
maps to the real path only inside the helper and is scoped to the session, so no
`.aep` path ever transits the panel or the proxy.

**Remembered choice:** AEBridge remembers the last-used `project_mode` and (in
`existing_project` mode) the last target project for the session, so the editor
picks once and subsequent sends reuse it without re-prompting. The panel still
shows the active choice with a one-click "change" affordance.

Path-safety note: a dialog selection is a deliberate user choice, so it is
allowed even outside the preconfigured allowed roots — but the resolved path is
recorded for the job, re-validated at write time, and the helper only ever
*adds a comp* to it (never deletes or rewrites unrelated contents). Reference
movies, sidecars, and renders still stay under the configured
`export_root`/`watch_root`; only the target `.aep` may live wherever the editor
keeps it.

### `GET /v1/aebridge/jobs` and `GET /v1/aebridge/jobs/{job_id}`

Poll job state. State machine:

```
exporting → ready_in_ae → rendering → returned → validated → (offered | swapped) → done
                                   ↘ error
```

`jobs/{job_id}` returns the sidecar, detected return path (once present), and a
validation report (rate/res/frame-count match vs. sidecar).

### `POST /v1/aebridge/return/{job_id}/import`

Import the validated return into Avid (LinkFile/ImportFile) and place it in the
target bin. Idempotent; safe to call once validation passes.

**Bin convention:** returns are grouped **one bin per reel/sequence**, not one
per shot (per-shot bins would multiply out of control). The target bin is
also **selectable** — the tool can ask where to drop the temp — with the
per-reel/sequence bin as the sensible default. Request:

```json
{ "target_bin": "AEBridge_Temps_REEL_2" }
```

If omitted, the helper derives the default bin name from the sidecar's
`sequence_name`.

### `POST /v1/aebridge/return/{job_id}/swap`

Perform the record-sequence swap at the shot's record TC. Only permitted when
`state = offered` (or `auto_swap` was set). Requires the return to have passed
validation. Records an undo-friendly action where MCAPI allows.

### `POST /v1/aebridge/jobs/{job_id}/cancel`

Stop watching / abandon a job.

### `GET /v1/aebridge/templates`

List available `.aep` templates (id, label, description) from `template_root`.

Panel must feature-detect via `/v1/version` and show **Update AEBridge Helper**
if a required route/feature is absent — never a raw 404.

---

## 6. Sidecar schema (`shot.json`)

Written by the helper on export; the single source of truth the return is
validated against.

```json
{
  "schema": "aebridge.sidecar/1",
  "job_id": "aeb_2026-07-22_A017C003_001",
  "shot_name": "A017C003",
  "sequence_name": "REEL_2_v14",
  "record_tc_in": "01:02:11:04",
  "record_tc_out": "01:02:14:22",
  "source_tc_in": "12:41:08:00",
  "frame_rate": "23.976",
  "drop_frame": false,
  "resolution": { "w": 1920, "h": 1080 },
  "handles": 8,
  "frame_count": 90,
  "reference": "ref.mov",
  "template_id": "lower_third_v2",
  "project_mode": "new_per_shot",
  "aep_path": "<aep_work_root>/aeb_…/comp.aep",
  "aep_comp_name": "A017C003_temp",
  "version": 1,
  "created": "2026-07-22T11:54:00-07:00"
}
```

Return validation compares the QuickTime's rate, resolution, and frame count
against this. A mismatch blocks the swap and surfaces a clear reason — this is
the guardrail against silently corrupting the cut.

---

## 7. MCAPI call sequence

**Export (send):**

1. `GetOpenProjectInfo` — project rate/res defaults.
2. Resolve selected mob → `GetMobInfo` — shot name, record TC in/out, source TC,
   rate, drop-frame, resolution.
3. `LoadMobsIntoViewer` (if needed to define the export range).
4. `ExportFile` — reference movie for the frame range (+ handles) to
   `export_root`.
5. Helper writes `shot.json`, then builds the comp per `project_mode`:
   - **new_per_shot** — copy the `.aep` template to `aep_work_root` and import
     the plate onto its timeline.
   - **existing_project** — resolve `target_project_token` to the editor's
     `.aep`, add a new per-shot comp built from the template, and import the
     plate into it.
   Then begins watching `watch_root`. (AE-side comp construction is done via
   ExtendScript/scripting through the helper, not `aerender`, since the editor
   works interactively in v1.)

**Return (swap):**

6. Watch folder detects the finished QuickTime; helper validates vs. sidecar.
7. `LinkFile` / `ImportFile` — bring the render into Avid.
8. On approval: place at record TC in the record sequence.
9. `SetMobInfo` — write the version stamp back so naming/versioning stays
   consistent.

---

## 8. After Effects dependency

`aerender` requires a real After Effects install on the artist's machine. The
helper is a single signed binary and **shells out to** the user's installed AE
— it bundles nothing.

Decisions to lock early:

- **AE discovery:** how the helper locates `aerender` (standard install paths,
  version probe). Expose the detected AE version in `/v1/version`.
- **Missing AE:** degrade gracefully — the panel should show "After Effects not
  found" rather than failing a job mid-flight.
- **Interactive vs. headless:** v1 is *interactive* — the editor works in AE and
  hits render; AEBridge templates the setup and handles both file handoffs. A
  future *headless* mode (fully `aerender`-driven from a data sidecar, no human
  in AE) is far more valuable but only works for truly templated graphics; keep
  it out of v1.

---

## 9. Failure modes to design for

- **Frame-range off-by-one** between Avid export and AE comp → validate frame
  count both directions; never trust, always compare.
- **Rate/color/res drift** on the return → blocked by sidecar validation before
  any swap.
- **Render never appears / partial file** → watch folder must wait for a stable
  file (size settle / lock check), with a timeout that moves the job to `error`,
  not a hang.
- **AE version mismatch** across a facility → probe and surface; don't assume.
- **Auto-swap trust** → default off; the swap is an explicit user action until
  the round-trip has earned trust.

---

## 10. Ship order (per runbook)

1. Publish signed/notarized helper release exposing `aebridge` first.
2. Verify OTA install; preserve prior behavior during propagation.
3. Deploy the panel UI (Send button + job list) only after the helper is live.
4. Reload the panel in Avid.

No AVPI change. Routine OTA.

---

## As built (refinements during implementation)

The original spec put MCAPI in the helper. In practice the Avid Panel SDK
injects the gateway address + access token into the **panel WebView**, so all
MCAPI runs **client-side** (in `src/utils/api/timeline.js`), mirroring the EB
panel. The helper owns the local filesystem side. Concretely:

- **Grab (panel, MCAPI):** `GetViewerMobs` (record monitor + playhead) →
  `CreateSubClip(use_marks_bounds, create_new_sequence)` from the timeline
  IN/OUT → read the retained **marker comment** and `SetMobInfo`-rename the new
  subclip **and** sequence to it → `GetMobInfo` for rate/res/TC/duration →
  `ExportFile` the sequence (named after the shot) into the helper's export dir.
  - `head_frame`/`end_frame` are set to **-1** (they default to 0 and would
    override `use_marks_bounds`).
  - Bin paths are probed across spellings (`Name.avb`, `Name`, absolute) because
    MC is picky; the destination bin is created/opened first.
  - `CreateSubClip` returns no id, so the new mobs are found by diffing the bin.
- **`POST /v1/aebridge/prepare` (helper):** reserves a job and returns a
  path-safe export dir (under `export_root`) for the panel to export into — path
  authority stays in the helper.
- **`POST /v1/aebridge/send` (helper):** accepts the panel-gathered `shot` +
  `reference_path`; validates the reference under `export_root`; **waits until
  the exported file's size is stable** (MC's `ExportFile` RPC returns before the
  file is flushed) before building the comp; then builds/launches AE.
- **AE launch:** via AppleScript `DoScriptFile` (not `AfterFX -r`), which runs
  the build script in the live app instead of stalling on the Home screen.
- **Export location:** one folder per shot under `~/Desktop/AEBridge/exports`,
  named `<YYYYMMDD>_<shot>` with `PLATE/` (exported plate + `shot.json`) and
  `RENDER/` (AE return) subfolders. The comp is pre-queued to render into
  `RENDER/`; the watcher scans only `RENDER/`, so there's no plate/render
  collision. The shot name comes from the panel's grab, so the flow is
  grab → `prepare(name)` → export. Overridable via env.

**Return trip (built):** the build script pre-queues the comp to render into the
job's watch dir (`~/Desktop/AEBridge/renders/<job>`). A helper background thread
(`service/watcher.py`) watches for a completed render (size-stable) and flips the
job `ready_in_ae → returned`. The panel polls `/jobs`, shows **Import to Avid**,
runs the MCAPI `ImportFile` **into the same bin the shot was exported from**
(`AEBridge_Temps`), and calls `POST /return/{job}/imported` to close the job
(`→ done`). Path safety: returns must resolve under `watch_root`.

**No destructive sequence swap by design.** Overwriting the plate with a flat
render loses extendability (no source link, no handles), so AEBridge returns the
temp to the bin and the editor cuts it in — the original plate stays intact.

**Handles from source media.** The grab uses
`CreateSubClip(create_new_sequence=true)` — it wraps the marked range in one
sequence (the correct, single export target). Those subclips still reference the
**source master clips**, so `add_frames_at_head/end = handles` pulls the source
clip's own media (real handles), clamped to available source frames. Using
`create_new_sequence=false` was tried but MC then emits a loose subclip per
clip/track and the wrong one gets exported — avoid it. `/return/{job}/swap` remains a stub and is not
used.

**Panel UX routes.** `POST /new-project` opens a native *save-as* `.aep` dialog
(name + location) for new-project mode; `POST /jobs/clear?all=` clears finished
(or all) jobs. The panel also: applies a user prefix/suffix to the plate name
(the Avid clip keeps the marker name), auto-refreshes the current-shot readout
(polls, since MCAPI has no push events), and remembers the last-used export
setting / prefix / suffix / project mode in `localStorage`.

Still possible: `ffprobe` validation of the return vs. the sidecar.
`integrations/mcapi.py` remains only as a dev fallback for running the panel
outside Avid.

## Resolved decisions

- **Own address:** AEBridge runs its own helper on `127.0.0.1:8010`
  (placeholder), separate from EB's `8000`.
- **No ElementalEngine:** that engine is EB-specific; AEBridge doesn't use it.
- **Return bin:** one bin per reel/sequence (not per shot), and the tool can ask
  where to put the temp — default derived from `sequence_name`.
- **Remember project mode:** yes — mode and target project persist for the
  session; editor picks once.
- **Template library:** distributed with the helper runtime, same for everyone.

## Open questions

- Undo semantics for the swap — how much can MCAPI cleanly reverse? *(Not yet
  determined.)*
- Final port number for the AEBridge helper (confirm `8010` is free of
  conflicts on target machines).
