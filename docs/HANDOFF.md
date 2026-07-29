# AEBridge — Agent Handoff

Context for the next agent/session continuing AEBridge. Read this + the docs it
points to before touching code.

## What AEBridge is

A standalone Avid Media Composer ↔ After Effects round-trip panel for VFX temp
plates. Editor parks the playhead on a shot on the record timeline → AEBridge
exports the V1 plate and opens an AE comp with it → editor renders → AEBridge
imports the render back into the same bin. Follows the Elemental Bender
architecture but is its **own** product (own helper port, no ElementalEngine).

- Repo: this folder (`AE_Bridge`), git remote `acohenvfx/AE_Bridge`.
- Stack: **Nuxt 2 / Vue 2** panel (Node 16, Yarn) + **Python FastAPI** helper.
- Read next: `docs/AEBRIDGE_DESIGN.md` (route contract + as-built),
  `docs/BUILD_AND_INSTALL.md` (run/build), `docs/PHASE_MULTIPLATE.md` (future
  phase). The `avid-panel-dev` skill covers the EB stack conventions.

## Status: single-plate round trip WORKS end to end (verified in Avid)

Grab V1 plate → export opaque plate → AE opens correctly-sized comp with the
plate → editor renders into the shared `render/` folder → helper watch-folder
flips the job to `returned` → panel **Import to Avid** does `ImportFile` back
into the export bin. Confirmed working by the user on real MXF media.

## The grab pipeline (as-built) — `src/utils/api/timeline.js`

`grabShot({ trackNumber })` → `grabSourceHandledMob` → `chooseTrackAndTarget`.
**One call grabs ONE plate** (one track) — export isolation is per-track and
there is no way around that. A stacked shot therefore takes N passes, and the
editor solos each track by hand (the panel cannot set track enable). **Auto-grab**
watches for each solo and grabs it, so they never leave the timeline.

1. **The chosen track** (`trackNumber`, default 1 = V1) must have content and be
   **enabled**, else it throws. Then the flatten guard: any *other* enabled
   video track with a clip under the playhead aborts the grab.
2. **Find the clip under the playhead** via that track's EDL:
   `exportEdlForTrack(seq, track)` (ExportEDL **does** honor `track_list` —
   CONFIRMED, see below) → helper `parse-edl` →
   `findClipAtPlayhead(clips, playheadTC)`. Gives `rec_in/rec_out` and
   `src_in/src_out`.
3. **Subclip** it: `createRawSubclip` with `useClipBounds` +
   `head_frame = playheadFrame` + **`enabled_tracks_only: true`**. Past the
   guard exactly one video track is enabled over the shot, so this is the
   isolated plate; we still require a subclip whose `Tracks` names a single
   video track.
4. **Source handles:** `extendWithHandles` re-subclips with
   `add_frames_at_head/end`, dropping only the edge Avid reports as unavailable
   (per-edge clamp), then a start/end **position sanity check**; on mismatch it
   falls back to the exact (no-handle) subclip. Handles are clamped **per
   plate**, which is why layer offsets subtract each plate's own head handles.
5. **Name:** **every** pass reads `getMarkers(seq, track)` — restricted to the
   grabbed track via the GetMarkers track filter **and** a client-side track
   guard — filtered to the clip's record span, then the marker **nearest the
   playhead**. V1's marker names the stack (`baseName`). An upper track prefers
   **its own** marker; `<base>_plNN` is only the fallback for a track with no
   marker. The user's prefix/suffix are applied to the plate FILE names at Send;
   the Avid subclips keep the raw marker name (deliberate — see Folders & UX).

**Stack plan:** `analyzeStack()` runs step 2 across every video track to list
what is under the playhead, without grabbing anything.

## Hard-won MCAPI facts (do NOT relearn the slow way)

- **MCAPI runs in the PANEL (WebView), not the helper.** Avid injects the
  gateway + token into the panel only. All timeline/MCAPI work is in
  `timeline.js`. The helper does filesystem/AE/paths.
- **`CreateSubClip` IGNORES `track_list`.** This is the single biggest trap. It
  uses ALL tracks (or all *enabled* tracks). The ONLY way to isolate a track on
  export is **`enabled_tracks_only: true`** — which respects the timeline's
  enabled-track state. This is confirmed in EB's own SubclipIt code/comments.
  Consequence: to export only V1, **V1 must be enabled and higher video tracks
  disabled** — and **the panel cannot set that state**; the editor does it by
  hand. (Driving the `Tracks` commands via `DoCommand` was tried and does not
  move it — see below.)
- **`CreateSubClip` does NOT fan one subclip per enabled track, and the `Tracks`
  column LIES.** (Verified in Avid 2026-07-28 — an earlier version of this doc
  claimed the opposite; that claim was wrong and cost a build.) With V1+V2 both
  enabled, MC returns **ONE** subclip of the enabled **composite**, labelled
  with the **bottom** track: its `Tracks` column reads exactly `V1` while the
  media is V2 over V1. So you **cannot** detect a flatten from the columns, and
  you cannot get a per-track plate stack out of one call.
  **The enable state is the only isolation lever, and it isolates exactly one
  track per grab.** A vertical stack therefore needs **one grab pass per track**
  with only that track enabled. `grabSourceHandledMob` enforces this up front:
  for every other enabled video track it runs that track's own EDL
  (`ExportEDL` *does* honor `track_list`) and, if a clip sits under the
  playhead, refuses the grab rather than exporting a flatten.
- **`DoCommand` / `GetListOfCommands` WORK. They were never denied to panels.**
  An earlier session hit `code=7` and recorded "access denied for panels" as a
  platform rule. It was a **missing manifest scope**: these RPCs carry their own
  `avid.mediacomposer.command` scope and `usesApi` only listed `general` +
  `timelineEditing`. With the scope declared (`build/manifest.mjs`),
  `GetListOfCommands` returns **730 commands** (CONFIRMED in Avid 2026-07-28).
  - There is a **`Tracks` category** with one command per track — `V1`…`V24`,
    `A1`…`A24`, i.e. the timeline track-selector buttons.
  - **BUT driving them does NOT change the export enable state.** Tried and
    PARKED 2026-07-29: Avid accepts the command (no error once paced) and
    `GetMobTrackInfo.enabled` never moves. So **track soloing remains manual** —
    `GetMobTrackInfo` is read-only and no write path has been found.
    Unresolved, and worth finishing if it ever matters: does
    `IsCommandsEnabled` report the command as disabled (⇒ Avid wants the
    timeline window focused, not the panel), or does a *different* field
    (`selected` / `monitored`) move instead (⇒ we were waiting on the wrong
    flag)? UI `.5` logs `toggle V<n>` / `toggle V<n> DID NOT TAKE` with a full
    before/after and `fieldsThatMoved` to answer exactly that. The experiment
    lives behind **Try auto-solo** in the Log section, out of the grab flow.
  - **Command ids are NOT sequential** (V1=6231, V2=6230, V3=6176, V10=6475).
    Never hardcode them — `getTrackCommandMap()` looks them up by name and
    caches per session.
  - They are **toggles, not setters**: read `GetMobTrackInfo`, flip only what
    differs, then **re-read to verify** (a wrong enable state silently yields a
    flattened plate).
  - **Avid runs ONE command at a time, and `DoCommand` returns BEFORE the
    command finishes.** Firing two back to back gives
    `code=2 {"ErrorMessage":"Can't start more than one command on time.","ErrorType":73}`.
    That is a **busy signal, not a refusal** — same "RPC returns early" trap as
    `ExportFile`. `doCommand()` retries on it with linear backoff (`isCommandBusy`),
    and `soloVideoTrack` waits for each track's enable state to actually flip
    (`waitForTrackEnabled`) before issuing the next — which both paces the
    commands and verifies each step. The panel also suspends its shot poll
    (`grabbingAll`) for the duration.
  - Changing `usesApi` means the `.avpi` must be rebuilt + MC restarted, and
    re-signed by Avid for distribution.
  - **Lesson:** "can't be done" entries deserve suspicion — the per-track fan
    and the DoCommand denial both fell. But the reverse also applies: reaching
    the API is not the same as it doing what you want. `DoCommand` became
    available and *still* couldn't set track enable.
- **ExportFile composites.** Exporting a sequence-derived subclip that spans
  multiple tracks renders the FLATTENED composite (V2 over V1), even though its
  `Source File` column shows one clip. Only an exactly-single-track subclip
  exports isolated media. This is why `enabled_tracks_only` matters.
- **`ExportEDL` genuinely honors `track_list`** (unlike CreateSubClip) —
  CONFIRMED in Avid 2026-07-28 on a 7-video-track sequence: each track got its
  OWN file (`…/Avid EDL Exports/SEQ.160.edl`, `.161`, `.162` — no path reuse,
  no stale-read hazard) with per-track counts (V1 24 events, V2 1, V3 1). So
  per-track *enumeration* is reliable; it is only per-track *media export* that
  is impossible. **This is the lever the multi-pass grab is built on.**
- **`numSegments` counts FILLER as well as clips**, so it never equals the EDL
  event count. Observed: V1 `numSegments 25` = 24 clips + 1 gap; V2/V3
  `numSegments 3` = 1 clip + filler either side. Use the EDL for clip counts;
  `numSegments > 0` only means "this track has something on it".
- **GetMarkers** returns each marker's `track_label` and accepts an optional
  `track` filter — used to take V1's comment on a stacked shot, not V2's.
- **Marks are not readable via MCAPI** (`GetValues` is test-only; ExportEDL
  ignores marks). We key off the **playhead**, not marks.
- **No delete-mob API.** Scratch subclips accumulate in an `AEBridge_Scratch`
  bin; not programmatically deletable.
- **CreateSubClip:** set `head_frame/end_frame` to **-1** unless you mean to use
  them (they default 0 and override marks/clip bounds). `use_clip_bounds:true` +
  `head_frame` = "the whole clip under this frame position."
- **Bin paths** are picky — probe `Name.avb` / `Name` / absolute; create/open
  first (`ensureBin` / `resolveBinPath`).
- **Export is async** — `ExportFile` returns before the file is flushed; the
  helper waits for a size-stable file. MC appends the codec extension, so pass a
  base name without extension.
- **AE launch** via AppleScript `DoScriptFile` (not `AfterFX -r`, which stalls on
  the Home screen). Comp duration set from the imported plate (Avid frame-count
  columns are unreliable).
- Generated gRPC getters sometimes differ from proto field names — verify
  against `src/utils/grpc-web/*.js` before using.

## Folders & UX

- **Flat folders:** all plates → `~/Desktop/AEBridge/plates/`, all renders →
  `~/Desktop/AEBridge/render/` (no per-shot subfolders). Config in
  `service/config.py`.
- **Duplicate-plate guard:** panel warns (window.confirm) before overwriting a
  same-named plate; user can add a prefix/suffix. Checks **every** plate in the
  stack, not just the base (marker-named upper plates can collide too).
- **Prefix/suffix apply to the plate FILES, not the Avid subclips** (deliberate:
  the Avid clip keeps the editor's marker name). The plate-stack list shows the
  final file name including affixes — `.9` showed the raw name, which read as
  the affixes being ignored.
- **On-screen MCAPI log** in the panel (Avid WebView has no console): ring buffer
  in `src/utils/api/mcapi.js` (`getMcapiLog`/`logMcapiVerbose`); Log section with
  Copy/Clear/Probe in `AEBridgePanel.vue`. **Collapsed by default** (`s.logOpen`,
  remembered in `localStorage`); the collapsed header still shows the entry
  count and an error count, so a failure stays visible without opening it. The
  ring buffer always captures regardless — collapsing only hides the view, so
  asking the user to open it after a failure still yields the full history.
- **UI build stamp:** `UI_BUILD` const in `AEBridgePanel.vue` renders as a header
  pill and logs on load. **Bump it on every UI change** so the user can tell
  which build the Avid WebView has cached (the WebView caches aggressively;
  reopen the panel to force a fresh bundle). Current: `2026-07-29.6`.
- Project persistence (remembers last `.aep` across panel reloads AND helper
  restarts, re-registering the path for a fresh token).

## Ports / run

- Helper `127.0.0.1:8010`; dev panel `127.0.0.1:3010` (CORS allowed). Release =
  helper serves the generated Nuxt build at `8010/app`.
- **Helper does NOT hot-reload** — restart `PYTHONPATH=. python -m service.app`
  after any `service/**` change. Panel (`yarn dev`) hot-reloads.
- **Therefore: feature-gate every new route.** A running helper is routinely
  older than the panel, so a panel calling a route it lacks gets a raw 404. Add
  an id to `FEATURE_IDS` (`service/config.py`), check `/v1/version`
  `feature_ids` in the panel before calling, and show "restart the helper"
  instead. This bit the Renders section (`aebridge.renders`, helper `0.0.2`):
  Rescan silently did nothing because the panel swallowed the 404. Regression
  test: `test_renders_feature_is_advertised`.
  **And never swallow a failed fetch in a refresh method** — a control that
  does nothing with no explanation is worse than an error.

**Tests must sandbox EVERY root.** `AEBRIDGE_HOME` only moves `base` —
`export_root` and `watch_root` default to `~/Desktop/AEBridge/{plates,render}`,
the user's REAL editorial folders, independent of base. `tests/test_smoke.py`
sets all four env vars and then **asserts at import time** that every
`settings.roots.all_roots()` entry is inside the temp dir, aborting before any
test can write. This is not hypothetical: on 2026-07-29 the smoke tests wrote
stub plates and renders into the live Desktop folders, where they showed up in
the panel's Renders list.

```bash
nvm use && yarn install && yarn dev        # 127.0.0.1:3010/app
PYTHONPATH=. python -m service.app         # 127.0.0.1:8010
PYTHONPATH=. python tests/test_smoke.py
node --check src/utils/api/timeline.js     # JS syntax, no Avid needed
```

MCAPI-dependent code can only be verified inside Media Composer (the `mcapi`
global exists only in the Avid WebView). Build to EB patterns, add verbose
logging, iterate with the user on real Avid results.

## What just shipped (this session)

The vertical multi-plate stack, via a **guided multi-pass grab** (UI
`2026-07-28.9`). One intermediate approach was refuted in Avid along the way.

- **Refuted (UI `.6`):** treating the `enabled_tracks_only` result as a
  per-track fan. With V1+V2 enabled, **one** plate reached AE showing **V2's**
  picture — a flatten labelled `V1`. Do not retry this shape; see the corrected
  MCAPI facts above.
- **Also refuted (my own hypothesis, UI `.8`):** that `ExportEDL` might ignore
  `track_list` or race on a reused file. It does neither — per-track paths and
  counts are clean. Per-track *enumeration* is solid.
- **Flatten guard:** before any grab, every *other* enabled video track is
  checked via its own EDL for a clip under the playhead; if one exists the grab
  **refuses**, naming the tracks to disable. `.6` lacked this and exported the
  flatten silently.
- **Guided multi-pass grab (NEEDS Avid verification):**
  - `analyzeStack()` (timeline.js) enumerates every video track carrying a clip
    under the playhead → the grab **plan**.
  - `grabShot({ trackNumber, baseName })` grabs **one** plate; V1's pass reads
    the marker and sets the base name, upper passes inherit it (`_plNN`).
  - Panel "Plate stack" section lists the plan (V1 at the bottom, like the
    timeline), walks the user track by track ("enable only V2 → Grab V2"), and
    accumulates `s.grabbed`. Re-Analyze **unions** with the existing plan so it
    can't drop pending plates if a disabled track goes unreported.
  - Send exports each collected plate and ships `plates[]`. Grab and Send are
    now **separate** steps (was one click).
  - `plateOffsets()` is a pure function computing AE layer offsets =
    (plate rec_in − its head handles) − (base rec_in − its head handles), so
    per-plate handle clamping is compensated. Unit-tested outside Avid.
- **Helper/AE (smoke-tested):** `SendRequest.plates[]` + `PlateRef`, per-plate
  path-safety + size-stable wait, `Sidecar.plates`, and a JSX that layers
  plates bottom→top with `layer.startTime = offset_frames/fps` (comp duration
  from the base plate; upper-plate import failures surface as a text layer).
  Smoke test: `test_multi_plate_send`.
- Fixed a pre-existing smoke-test bug (`/tmp` symlink path comparison).

### Prior session (verified in Avid)
- V1-only grab via playhead+EDL; isolation via `enabled_tracks_only` (the
  `track_list`-is-ignored discovery); flatten guard; source handles via
  clip-bounds subclip + per-edge-clamped extend; V1-track marker nearest the
  playhead; UI build stamp pill. Rejected: Match Frame (DoCommand
  access-denied), master-subclip-by-source-TC (Format Descriptor errors).

## Grabbing a stack — soloing is MANUAL (UI `2026-07-29.6`)

The panel cannot set track enable (see the `DoCommand` note above), so the
editor solos each track by hand. Two modes:

1. **Auto-grab — ON by default.** The shot poll watches the enable state and
   grabs a plate the moment exactly one stack track is soloed. The editor stays
   in the timeline and works down the stack; they never return to the panel.
   Rules: exactly one stack track enabled; that track ungrabbed; **V1 first**
   (it names the stack); never while another operation is in flight. Tracks
   outside the stack are ignored — no picture over this shot, so no flatten
   risk. `autoGrabStatus` says why it is waiting.
2. **Per-track buttons.** Fully manual, for when auto-grab is off.

`doGrabAll()` / `soloVideoTrack()` (the auto-solo attempt) are **retained but
out of the flow**, behind **Try auto-solo** in the Log section. They are
correct apart from the unresolved question of why the enable state won't move,
and are the starting point if that is ever picked up again.

## Polling cost (UI `.13`)

MCAPI has **no push events**, so the shot readout must poll — and each tick is
**3 RPCs** into Media Composer (`GetViewerMobs`, `GetOpenProjectInfo`,
`GetMobInfo`). `shotPollTick()` keeps that honest:

- **Hidden panel → no polling at all** (`visibilitychange`).
- **Idle backoff:** unchanged playhead for ~12s (`IDLE_TICKS_BEFORE_SLOW`) drops
  the effective rate from 1.5s to 6s; any change, refocus, or `wakePolling()`
  restores it.
- **Never backs off** while auto-grab is on or a grab/send is in flight.
- **Pause updates** chip stops it outright (remembered); Refresh still works.

## Renders list, orphaned jobs, hard reset (UI `2026-07-29.1`)

- **`GET /renders`** lists **every** media file in `watch_root` with an
  `imported` flag, matched to a job by `render_stem` where possible. The
  per-job watcher only ever claims ONE render, so a v2/v3 out of the same comp
  was previously invisible — this is how those get imported. `POST
  /renders/imported` records the import (tracked **per file**, not per job).
- **Orphaned jobs:** `JobView.plates_missing` lists plate files no longer on
  disk (`Job.plate_paths` is populated at send). A job whose plate was deleted
  can never be re-rendered, so the panel flags it and offers **Remove**
  (cancel → error → clear finished).
- **`POST /reset`** drops every job whatever its state. Files on disk are
  untouched. Panel: **Hard reset** (confirms first).
- **Import history is PERSISTED and survives both hard reset and a helper
  restart** (`<base>/imported_renders.json`, `Store._load/_save_imported`).
  Once a render is in Avid it is in Avid — the editor may have moved the clip
  to another bin, and re-offering it would invite a duplicate import. Use
  `store.forget_imported_renders()` if that ever needs clearing deliberately;
  `reset()` must not. Tests: `test_renders_listing_and_reset`,
  `test_imported_renders_survive_helper_restart`.
- **Polled lists must not thrash the DOM.** `refreshJobs`/`refreshRenders`
  compare a `sig()` (JSON) of the new list and only reassign on a real change,
  and background polls pass `quiet` so the button never flips to "Reading…".
  Reassigning a fresh array every 4s makes Vue rebuild every row — the user
  saw it as a glitch.
- **A render still being written** (mtime within `_RENDER_SETTLE_SECS`) is
  flagged `writing`, shown as "rendering…" with no size, and cannot be
  imported — both to stop the size text jittering each poll and to prevent
  importing a truncated movie.
- **Re-grab:** each grabbed plate has a **Re-grab** button, and **Reset stack**
  clears the whole plan. Dropping V1 resets the entire stack, since V1's marker
  names every other plate. Neither deletes the Avid subclip (no delete API) —
  they only forget it here, which is what you want after deleting it by hand.
- **Template picker is hidden** while `__blank__` is the only template;
  `s.templateId` still flows to `/send`. It reappears if `template_root` ever
  gains real templates.
- **No Refresh button** on Current shot (it self-refreshes) — except while
  **Pause updates** is on, when it is the only way to update.

## Next steps / open items

- **Auto-solo is PARKED, not abandoned.** One run of **Try auto-solo** (Log
  section) with UI `.5`+ answers why: `commandEnabled` false ⇒ focus; a moved
  `selected`/`monitored` ⇒ wrong flag. Worth doing before anyone re-attempts it.
- **730 commands are now reachable** — worth a read-through of the list for
  other things AEBridge does by hand today. `Timeline/Mixdown → Video…` (1937)
  in particular might offer a different route to a flattened plate.
- **Consumer-simplification pass (agreed, not built):** one Send button doing
  analyze → grab → export → launch; Jobs + Renders merged into one **Shots**
  list with versions nested; set-once settings behind a disclosure; build pill,
  log, probe, pause, hard reset behind **Diagnostics**. Prefix/suffix **stay**,
  moved onto the shot card beside the resulting plate name (per-shot naming is
  a real editorial need, not just collision avoidance). NOTE: one-button Send
  can only fold in the *grab*, not the soloing, while auto-solo is parked.
- **Verify the guided stack grab in Avid.** Test sequence `DE_DEMO_NEW`, playhead
  `01:03:03:01`: V1+V2+V3 all carry a clip over `01:03:03:01 → 01:03:20:04`
  (identical spans, so all offsets should compute to **0**). Sequence: Analyze →
  enable only V1 → Grab V1 → enable only V2 → Grab V2 → V3 → Send. Check the
  comp gets 3 correctly-stacked layers and the plate names are
  `<marker>` / `_pl02` / `_pl03`.
- **UNKNOWN: does `ExportEDL` report a DISABLED track?** Analyze is meant to run
  with tracks in their normal (enabled) state; mid-stack the user has tracks
  off. Re-Analyze unions with the existing plan so this can't drop pending
  plates, but the answer is worth pinning down — if disabled tracks *are*
  reported, Analyze can be re-run freely at any point.
- **Then: a stack whose tracks have DIFFERENT spans** (V2 shorter than V1), to
  exercise a non-zero `offset_frames` end to end. The math is unit-tested but
  has never been seen in AE.
- **Horizontal batching** (marked range → one temp per V1 clip → N jobs) — see
  the status note atop `PHASE_MULTIPLATE.md`; needs the marked-range derivation
  rebuilt and verified.
- **Plan-preview UX (4c):** editable per-plate names before Send.
- **Scratch-bin cleanup** — subclips accumulate in `AEBridge_Scratch` (no delete
  API). Investigate a safe cleanup path.
- Return-side validation (`ffprobe` rate/res/frame-count) is stubbed.

## Git / gotchas

- **Do git on the user's Mac**, not in the sandbox (virtio-fs leaves stale
  `.git/*.lock` that jam Mac git; if seen: `find .git -name '*.lock' -delete`).
  No credentials in the sandbox.
- This session's work was committed on the user's Mac (V1 isolation + V1 marker).
  Files touched: `src/utils/api/timeline.js`, `src/components/AEBridgePanel.vue`.
