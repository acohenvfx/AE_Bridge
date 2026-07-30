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

## Status: the FULL grid works end to end (verified in Avid 2026-07-29)

All three shapes confirmed by the user on real MXF media:

1. **Single plate.** Park the playhead → grab → export → AE comp → render into
   the shared `render/` folder → watcher flips the job to `returned` → **Import**
   does `ImportFile` back into the export bin.
2. **Vertical stack.** One shot, several video tracks → one plate per track
   (solo each track; auto-grab picks it up) → one layered comp, plates stacked
   bottom→top with per-plate `startTime`.
3. **Horizontal batch.** IN/OUT marks over several shots → **Analyze range** →
   **Grab V<n> for all shots** once per track → **Send N shots** → N jobs, N
   comps, N renders returning independently.

Also verified: **`plateOffsets` in AE** — a stack whose tracks have different
spans lands with the layers correctly offset (this had only been unit-tested
until now, since every earlier test stack shared one span).

What is NOT verified: auto-solo (parked — see the `DoCommand` fact), and
`ffprobe` return validation (still stubbed).

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
   `add_frames_at_head/end`, then a start/end **position sanity check**; on
   mismatch it falls back to the exact (no-handle) subclip. Handles are clamped
   **per plate**, which is why layer offsets subtract each plate's own head
   handles.
   **Handle availability must never fail a grab.** Different clips on one track
   sit at different source positions, so one shot can have handles at both edges
   and its neighbour none —
   `code=2 {"ErrorMessage":"Invalid add_frame_at_head: Requested frames not available.","ErrorType":66}`.
   The clamp is an explicit **ladder**: `[h,h] → [0,h] → [h,0] → [0,0]`, any
   `handlesUnavailable` error stepping to the next rung. It used to parse Avid's
   error text to decide which edge to drop, which **dead-ended** (Avid still says
   `add_frame_at_head` once head is 0) and threw, killing a whole range batch
   over one missing handle. If every rung refuses, `grabSourceHandledMob`
   exports the exact scratch subclip it already holds rather than throwing — a
   plate with no handles is still a usable plate. Non-handle errors still
   propagate. Unit-tested against the real error string (`handles.mjs`).
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
- **TWO FRAME SPACES. Do not mix them.** `CreateSubClip`'s `head_frame` /
  `end_frame` are **relative to the sequence start**; EDL timecodes and mob
  columns are **absolute**. Avid's own `GetViewerMobs.currentFrame` proves it:
  `4804` for `01:03:20:04` on a sequence starting `01:00:00:00`.
  Passing an absolute frame (`90170`) into a sequence only 11674 frames long
  gets you **`Invalid add_frame_at_head: Requested frames not available.`
  (ErrorType 66)** — a message that says nothing about frame position and sent
  this hunt into the handle code twice before the log showed the failure was in
  step 1, not `extendWithHandles`. `analyzeRange` keeps both (`atFrame`
  relative, `atTC` absolute) and `grabSourceHandledMob` now range-checks
  `head_frame` against `Frame Count Duration` and says what is actually wrong.
  Unit-tested against this sequence (`frames.mjs`).
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
- **MARKS *ARE* READABLE — via `GetMobInfo` columns.** CONFIRMED in Avid
  2026-07-29: the record sequence's own columns include **`Mark IN`**,
  **`Mark OUT`** and `IN-OUT` (e.g. `01:03:03:01` / `01:03:20:04` / `17:03`).
  `getCurrentShot()` now returns `markIn`/`markOut`, and `analyzeRange()` splits
  the marked range into one shot per V1 clip. This is the **third** "can't be
  done" in this doc that turned out to be false — the earlier conclusion came
  from `GetValues` being test-only and ExportEDL ignoring marks; nobody checked
  the mob columns. The stale claim is kept below only as a warning:
- ~~**Marks are not readable via MCAPI**~~ — WRONG, see above. What *is* true:
  `GetValues` is test-only and ExportEDL ignores marks, so the single-shot grab
  keys off the **playhead**. Range work reads the marks from the mob columns.
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
  Copy/Clear/Probe in `AEBridgePanel.vue`. **OPEN by default** while the round
  trip is still being debugged (`s.logOpen`, remembered under `logOpen.v2` — the
  key was bumped so a stored "collapsed" from the old default couldn't override
  it). Collapse it for a consumer build. The collapsed header still shows the
  entry count and an error count, so a failure stays visible without opening. The
  ring buffer always captures regardless — collapsing only hides the view, so
  asking the user to open it after a failure still yields the full history.
- **No sidebar.** `src/pages/app.vue` is just the tool: the nav/brand aside was
  vestigial (one tool, one nav item) and style.scss hid it below 900px anyway,
  which is where the panel usually sits docked in Avid. The `.eb-sidebar`,
  `.eb-nav` and `.eb-link*` rules are deleted; `.eb-brand*` stays because the
  tool head uses it. `panelToolShellMixin` is kept for `activeGroup` (it drives
  the accent hue) and for registering more tools later. The panel version
  (`PANEL_VERSION`) is no longer displayed anywhere — the head shows the UI build
  stamp and helper version instead.
- **Two-tier header** (from the *AEBridge Critique* design doc, 2026-07-30).
  Tier 1 is a thin **identity bar** on `--field-0`: wordmark, **one rolled-up
  status pill**, Reset. The three per-service pills (helper / AE / UI build)
  collapsed into a single `statusSummary` — the bar answers "is the bridge
  live?" rather than enumerating subsystems. It names whatever is actually
  wrong (`Helper offline`, `After Effects not found`, `Not in Media Composer`)
  and stays clickable to the AE diagnostics in that state; the per-service
  detail lives in the pill's `title`. **The UI build stamp moved to the
  Diagnostics section header and is ALWAYS shown there** — it used to render
  only when the log was collapsed, and the log now defaults open, so it would
  otherwise have vanished exactly when it is checked most.
- **Branding / header.** The app name lives in `AEBridgePanel.vue`'s tool head
  as an `.eb-brand--inline` lockup: **Difference-Engine-style rounded-square
  chip (`.eb-brand-mark`, 21px) + the critique's two-tone wordmark**
  (`AE <b>Bridge</b>`, 23px/700 — sized to match DE, which is noticeably larger
  than the tool-title scale). Reuses the `.eb-brand-title b` colouring already in
  style.scss. **No version** —
  it reads as diagnostics, and the identity bar is deliberately clear of those;
  `PANEL_VERSION` is consequently not displayed anywhere (the UI build stamp in
  the Diagnostics header is the one people actually check). Two earlier takes
  were tried and dropped: an eyebrow/title/sub block (removed at the user's
  request) and a Difference-Engine-style chip + single-weight name + version.
  The head also
  centre-aligns its two columns and runs the status pills as one wrapping row;
  the shared styles assume a three-line eyebrow/title/sub on the left, which
  this panel no longer has.
- **Palette matches After Effects** (2026-07-29). Sampled from the AE app icon:
  the glyph `#9A9AFF` is `oklch(0.728 0.145 282)`, which lands almost exactly on
  this stylesheet's existing accent recipe (L .74 / C .15) — so matching AE's
  accent was purely a **hue** change. The icon's background `#00005B` is
  `oklch(0.213 0.148 264)`: the same *lightness* as the old surfaces but ~3.5x
  the chroma. Surfaces now sit at **hue 264, chroma 0.075** — each keeping its
  original lightness, only hue/chroma moved. Deliberately short of AE's full
  0.148: past ~0.11 the cards stop separating from the backdrop and the slate
  text ramp (`--muted`, `--faint`, tuned for a desaturated ground) goes dim.
  Retune that ramp first if anyone wants to go deeper. Hairlines were re-tinted
  blue to match.
- **Brand hue is ONE number:** `--brand-h` in `style.scss` (now **282**, AE's
  periwinkle). It feeds `--gh -> --ah -> --accent/-soft/-line/--glow`, so changing it
  restyles every accent. Two gotchas: (1) `[data-group='bridge']` must stay
  `var(--brand-h)` or the wordmark changes but the accents do not; (2) the
  `--accent*` vars are declared on `:root` and therefore already substituted, so
  overriding `--brand-h` on a descendant does nothing — redeclare the derived
  set if you ever need a local override. Keep the hue **out of the green / amber
  / pink-red families**: those are `--ok`, `--warn` and `--bad`, and an accent
  sharing them blurs what a status means.
- **UI build stamp:** `UI_BUILD` const in `AEBridgePanel.vue` renders as a header
  pill and logs on load. **Bump it on every UI change** so the user can tell
  which build the Avid WebView has cached (the WebView caches aggressively;
  reopen the panel to force a fresh bundle). Current: `2026-07-30.4`.
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

**`yarn check:tpl` — run it after any panel template edit.** Vue compiles a
mid-chain `v-else` without complaint and silently drops every branch after it.
That happened when Pause updates was inserted into the Diagnostics block as a
`v-else`: it swallowed the `logOpen === true` case and left the console below
unreachable, so **the entire MCAPI log rendered nothing** while looking fine.
`tools/check-vue-template.js` walks the compiled AST and fails on any `v-else`
that is not last in its chain. Neither `node --check` nor `compile()` errors
catch this.

```bash
nvm use && yarn install && yarn dev        # 127.0.0.1:3010/app
yarn check:tpl                             # unreachable v-else branches
PYTHONPATH=. python -m service.app         # 127.0.0.1:8010
PYTHONPATH=. python tests/test_smoke.py
node --check src/utils/api/timeline.js     # JS syntax, no Avid needed
```

MCAPI-dependent code can only be verified inside Media Composer (the `mcapi`
global exists only in the Avid WebView). Build to EB patterns, add verbose
logging, iterate with the user on real Avid results.

## What shipped in the 2026-07-28/29/30 sessions

Roughly in order. **Everything below is verified in Avid**, including the
2026-07-30 header work (confirmed rendering correctly in the Avid WebView).

1. **Vertical plate stack.** One plate per video track over a shot, layered into
   one comp. Soloing is manual (see the isolation facts); **auto-grab** watches
   the enable state so the editor never leaves the timeline.
2. **Horizontal batch.** `Mark IN`/`Mark OUT` read from the sequence's mob
   columns; one shot per V1 clip in range; **soloing is per TRACK, not per
   shot**, so N shots × M tracks costs M solos; one Send fans out to N jobs.
3. **Renders + versions.** Every file in the render folder is listed and
   importable, so extra versions out of one comp are usable; per-shot version
   dropdown with **Import all N**; orphaned jobs (plate deleted) offer Remove;
   **Reset** in the header clears a wedged queue.
4. **Consumer simplification.** Jobs + Renders merged into one **Shots** list;
   Settings and Diagnostics behind disclosures; prefix/suffix kept in the main
   flow next to the plate names they affect.
5. **Look (2026-07-29).** App-name lockup, AE's periwinkle accent (hue 282) and
   a subtle indigo lift on the surfaces; the vestigial sidebar removed.
6. **Two-tier header (2026-07-30),** from the *AEBridge Critique* design doc —
   see the section below. Thin identity bar, three status pills rolled into one,
   build stamp relocated to Diagnostics. Confirmed in Avid.

**Approaches tried and REFUTED — do not retry these shapes:**

- Treating the `enabled_tracks_only` result as a **per-track fan**. With V1+V2
  enabled, one plate reached AE showing V2's picture — a flatten labelled `V1`.
- **`ExportEDL` ignoring `track_list` / racing on a reused file.** It does
  neither; per-track paths and counts are clean. Per-track *enumeration* is
  solid. (This was my own wrong hypothesis, and chasing it cost a build.)
- **Driving track enable via `DoCommand`.** Accepted by Avid, but the enable
  state never moves. Parked behind **Try auto-solo** in Diagnostics.
- Earlier sessions: Match Frame via `DoCommand` (then thought to be denied
  outright), and master-subclip-by-source-TC (Format Descriptor errors).

**Three bugs worth remembering, because none were what the error said:**

- `Invalid add_frame_at_head` was really an **out-of-range `head_frame`** (the
  two frame spaces). It sent the hunt into the handle code twice.
- A mid-chain **`v-else`** silently dropped every following branch, so the whole
  MCAPI log rendered nothing — while looking fine. `yarn check:tpl` now catches
  it.
- A **stale helper** 404'd a new route and the panel swallowed it, so a control
  did nothing with no explanation. Feature-gate every new route.

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

## Marked range → many shots (VERIFIED in Avid 2026-07-29)

A marked range spanning several shots becomes one comp/job **per V1 clip**,
each with its own vertical plate stack. Enumeration, per-track batch grab and
the N-job fan-out are all confirmed working.

- **`analyzeRange()`** reads `Mark IN`/`Mark OUT` from the sequence's mob
  columns (see the marks fact above), runs each video track's EDL **once**, and
  returns one shot per V1 clip **overlapping** the range — a range starting
  mid-clip still includes that shot. Each shot carries `atTC`/`atFrame` (a frame
  just inside the clip) plus its own stack.
- **Nothing moves the playhead.** `findClipAtPlayhead` is just "the clip at this
  TC", and `CreateSubClip` takes an arbitrary `head_frame`, so any clip in the
  range is targetable directly. `grabShot({ atTC, atFrame })` now takes an
  explicit position, defaulting to the playhead — that generalisation is what
  makes range grabbing possible at all.
- **Soloing is per TRACK, not per shot.** `doGrabTrackAcrossRange(track)` grabs
  that one track's plate for **every** shot in the range, so N shots × M tracks
  costs only **M** manual solos. This is why the manual-soloing limitation
  matters far less at scale than it first appears. V1 goes first (each shot's
  own V1 marker names that shot's stack); upper tracks inherit per shot.
- **`doSendRange()`** fans out to one job per shot, reusing `sendOneShot()` —
  which `doSend()` also calls, so the single and batch paths cannot drift.
  Stops on the first failure so a partial batch is obvious.
- Per-shot state lives on the range object (`sh.grabbed`, `sh.baseName`,
  `sh.shotMeta`) via `$set`, separate from the single-shot `s.grabbed`.

## Panel layout (UI `2026-07-29.7` → `2026-07-30.4`)

Four always-visible things: **Current shot**, **Plate stack**, **Send**,
**Shots**. Everything else is behind a disclosure. Nothing was removed —
controls moved from *always visible* to *visible when relevant*.

**The header is two tiers** (from the *AEBridge Critique* design doc — imported
from claude.ai/design via the `DesignSync` MCP, project
`cfa27e1a-300d-4176-a999-73c217219cbb`). Tier 1 is a thin identity bar on
`--field-0`; the body carries everything that explains the tool. Its diagnosis
was that the header fused app identity with live diagnostics — wordmark,
version, Reset and three status pills competing in one strip.

**Not everything in that doc was applied**, and the reasons matter if anyone
re-reads it:

- Its headline recommendation is an **eyebrow / title / description** beat. The
  prose claims it, but tier 2 in the doc's own `1b` markup is **empty** — and the
  user had explicitly asked for that text to be removed. Markup and user agreed;
  only the prose dissented.
- The prose says **Reset** moves to the content header, but it appears nowhere in
  the `1b` markup and would have been silently lost. The user had explicitly
  asked for Reset in the header. Kept there — it fits now the pills collapsed.
- Its wordmark is a recreation of an **older** header. The current lockup is DE's
  square chip + the critique's two-tone wordmark, at DE's larger scale.

Lesson for the next design import: **read the markup, not just the prose** — they
disagreed in two places here, and the markup was the better guide.

- **Shots** replaces the separate Jobs and Renders lists. `shots` (computed)
  merges them by **shot name** — `JobView.shot_name` (added to the helper for
  this; falls back to `job_id` on an older helper so rows stay distinct rather
  than collapsing). Status precedence: plate missing → render ready →
  rendering → in bin → the job's own state. Also hosts **Rescan renders**.
- **Versions.** Every render of a shot nests under it, newest first. With more
  than one, a caret expands a per-version list, each with its own **Import**,
  and the root offers **Import all N** (`doImportAll`, sequential, stops on the
  first failure). One importable version = a plain **Import**; a still-writing
  render is excluded from the count and cannot be imported. So a v002/v003 out
  of one comp is "another version of a shot you recognise", and you can pull in
  an older version, not just the newest. Pure-function tested (`shots.mjs` /
  `shots2.mjs` in scratch, 12 cases incl. the no-`shot_name` fallback,
  newest-first ordering and excluding `writing` renders).
- **Reset** (was "Hard reset") sits in the panel header, next to the status
  pills — it is the escape hatch for a wedged queue and shouldn't be two
  disclosures deep.
- **Settings** (collapsed, remembered): handles, template, export preset,
  project mode + `.aep`. Header shows a one-line summary so the values are
  legible without opening it.
- **Diagnostics** (collapsed, was "Log"): the MCAPI log plus Pause updates,
  Probe commands, Try auto-solo. Collapsed header still shows the build stamp
  and an error count.
- **Prefix/suffix stay in the main flow**, on the Plate stack next to the plate
  names they change — per-shot naming is a real editorial need, not just
  collision avoidance, so it must not be buried in Settings. The plate rows
  update live as you type.
- **Not done:** folding analyze+grab into Send. Blocked by manual soloing —
  Send can only fold in grab+export, so the flow stays "solo → auto-grab →
  Send" until auto-solo is solved.

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
  `reset()` must not.
- **A path is NOT an identity.** Records are keyed by path but validated against
  the file's **mtime + size** (`Store._stamp`). Deleting a render and
  re-rendering to the same filename — the normal way to fix a bad temp —
  produces a different file that has never been imported; keying on the path
  alone left it reading "in bin" forever with no way to import the replacement.
  The on-disk format is `{path: {mtime, size}}`; the old bare-list format is
  migrated on load by adopting each surviving file's current stamp (so existing
  imports stay imported) and dropping records whose file is gone. A corrupt
  state file is tolerated — never let it stop the helper booting.
  Tests: `test_renders_listing_and_reset`,
  `test_imported_renders_survive_helper_restart`,
  `test_rerender_to_same_name_is_not_imported`.
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
- **Consumer-simplification pass — DONE** (see the panel-layout section):
  Shots list, Settings/Diagnostics disclosures, prefix/suffix kept in the main
  flow. NOT done: folding analyze+grab into one Send button — while auto-solo is
  parked, Send can only absorb grab+export, not the soloing.
- **UNKNOWN: does `ExportEDL` report a DISABLED track?** Analyze is meant to run
  with tracks in their normal (enabled) state; mid-stack the user has tracks
  off. Re-Analyze unions with the existing plan so this can't drop pending
  plates, but the answer is worth pinning down — if disabled tracks *are*
  reported, Analyze can be re-run freely at any point.
- **Scratch-bin cleanup** — subclips accumulate in `AEBridge_Scratch` (no delete
  API), now several per shot per track, so a range batch fills it fast. This is
  the most likely next annoyance in daily use.
- **Return-side validation (`ffprobe` rate/res/frame-count) is stubbed** — the
  sidecar records the expected numbers but nothing checks the render against
  them. The guardrail against silently cutting in a wrong-rate temp.
- **Plan-preview UX (4c):** editable per-plate names before Send.
- **Duplicate clips after a re-render.** Importing a re-rendered version adds a
  second clip to the bin beside the first (correct — different media), but Avid
  has no delete-mob API so the panel can't tidy the stale one.

## Git / gotchas

- **Git runs natively here** — this repo is on the user's own Mac (APFS, not a
  virtio-fs share), so `git` works normally from the session. Verified
  2026-07-29. The older warning about doing git only on the user's Mac applied
  to a sandboxed setup; if you ever DO see stale `.git/*.lock`, clear them with
  `find .git -name '*.lock' -delete`.
- The user usually commits/pushes themselves — offer the command rather than
  pushing unasked, and never push without being asked.
- **`tests/test_smoke.py` sandboxes every root** and asserts it at import time.
  Do not weaken that: with only `AEBRIDGE_HOME` set, the tests wrote stub plates
  and renders into the user's REAL `~/Desktop/AEBridge` folders (2026-07-29).
