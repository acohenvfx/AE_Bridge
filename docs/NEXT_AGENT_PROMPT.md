# Next-agent kickoff prompt

Paste the block below to the next agent/session.

---

You're continuing **AEBridge**, a standalone Avid Media Composer ↔ After Effects
round-trip panel for VFX temp plates. It lives in the `AE_Bridge` folder (Nuxt 2
/ Vue 2 panel + Python FastAPI helper on port 8010). Its own product, modeled on
the Elemental Bender panel but sharing no engine.

**Read `docs/HANDOFF.md` in full before touching anything.** It is current and
carries hard-won MCAPI facts that cost days to learn. Then skim
`docs/AEBRIDGE_DESIGN.md` (route contract) and `docs/PHASE_MULTIPLATE.md`
(complete). Invoke the `avid-panel-dev` skill for EB-stack conventions.

**Current state: the full grid works end to end, verified in Avid.** Single
plate, vertical stack (one plate per video track, layered comp), and horizontal
batch (IN/OUT marks over several shots → N jobs). Grab → export → AE comp →
render → import back to bin, all confirmed on real MXF media. The most recent
work (UI `2026-07-30.4`) was presentation only — a two-tier header, the three
status pills rolled into one, and the app-name lockup — and is confirmed
rendering correctly in Avid.

**Non-negotiable facts (all detailed in HANDOFF.md — do not relearn these):**
- MCAPI runs in the **panel WebView**, not the helper. Timeline code =
  `src/utils/api/timeline.js`.
- **Two frame spaces:** `CreateSubClip`'s `head_frame` is **sequence-relative**;
  EDL timecodes and mob columns are **absolute**. Mixing them yields a wildly
  misleading "Invalid add_frame_at_head" error.
- `CreateSubClip` **ignores `track_list`** and does **not** fan per track; its
  `Tracks` column **lies**. Only `enabled_tracks_only` isolates, one track per
  grab — hence manual soloing.
- The helper does **not** hot-reload (restart after `service/**` edits) — so
  **feature-gate every new route** in `FEATURE_IDS` and check `/v1/version`
  before calling it, or a stale helper 404s silently.
- **Bump `UI_BUILD`** in `AEBridgePanel.vue` on every UI change; the Avid WebView
  caches aggressively and the header pill is how the user knows what loaded.
- **You cannot verify MCAPI code yourself** — the `mcapi` global exists only
  inside Avid. Write to the EB patterns, log via `logMcapiVerbose`, and iterate
  with the user against real Avid runs and the on-screen log.
- Before handing back: `node --check` the JS, `yarn check:tpl` (catches a
  mid-chain `v-else` silently dropping branches), and
  `PYTHONPATH=. python tests/test_smoke.py`.
- Git runs natively on this Mac; the user usually commits themselves, so offer
  the command rather than pushing.
- **You can see UI changes without Avid.** Compile `src/assets/scss/style.scss`
  with `npx sass`, inline it with the SFC's scoped block around the real
  markup, serve it over `localhost` and screenshot it in the browser. Avid's
  WebView can't be reached, but everything visual can be checked this way —
  do that rather than guessing at colours and spacing.
- Design feedback may arrive as a claude.ai/design doc; read it with the
  `DesignSync` MCP (`get_project` → `list_files` → `get_file`). **Read the
  markup, not just the prose** — on the one imported so far they disagreed
  twice, and the markup was right both times.

**If Analyze / stack scan / range scan all fail at once with
`ExportEDL ErrorType 1000 "EDL file not saved"`, it is NOT the code** — Avid's
`<SEQ>.NNN.edl` filename counter in `~/Avid EDL Exports` is full (001–999).
Archive that folder's EDLs and it works again. AEBridge burns one filename per
video track per analyze, so it refills fast. See HANDOFF.md.

**FIXED 2026-08-04: EDLs are now deleted after a successful parse**, so this
should mostly stop recurring for future sessions (the 700+ pre-existing files
in `~/Avid EDL Exports` from before the fix are still there — untouched
deliberately, see HANDOFF.md — but none were near the ceiling). This also
fixed a second, previously-undiscovered bug: `AVID_GENERATED_EDL_ROOT` in
`service/edl_recovery.py` pointed at a folder Avid never actually writes to,
so the error-1000 recovery search wasn't scanning the real export directory
either. See HANDOFF.md for the full story and the two regression tests.

**FIXED 2026-08-04: `plateOffsets` stacking bug — a stack's upper plate could
land far outside the AE comp.** Root cause was NOT the AE script, the handle
ladder, or the "VFX toolkit edl" preset losing track labels (all suspected and
ruled out first) — it was that two separate per-track `ExportEDL` calls for
clips confirmed at the identical Avid timecode returned `rec_in` 624 frames
apart, and the old formula compared `rec_in` across tracks. Fixed by aligning
plates on `head_handles` alone (every track in a stack shares one `headFrame`
anchor by construction, so no cross-track EDL comparison is needed at all).
See HANDOFF.md for the full diagnosis and `tests/test_plate_offsets.mjs`
(`yarn test:offsets`) for the regression case. **The bug that reported it**
also surfaced Bug 1 below, still open.

**FIXED 2026-08-04: `frame_count` validation no longer permanently blocks
Import when the expected count is 0/uncaptured.** Confirmed on a real job
(`260804_testCAM_101_001_0140_pl01`, `frame_count: 0` in its sidecar) — Import
either errored `"frame count 197 != expected unknown"` or silently did
nothing, forever, since the expected value can never be filled in after the
fact. `service/media.py`'s `validate_video` now treats `expected_frame_count
<= 0` as "never captured, skip this one check" rather than "confirmed
mismatch" — rate/resolution still gate normally, and the skip is called out
in `ValidationReport.detail` ("frame count not checked...") rather than
silently passing. Tests:
`test_validate_video_skips_frame_count_check_when_never_captured`,
`test_validate_video_still_blocks_wrong_rate_when_frame_count_unknown`
(`tests/test_media_validation.py`). Helper restart required (Python change).
**Not investigated:** why `frame_count` ends up 0 for some shots in the first
place (`grabShot()` in `timeline.js` derives it from bin columns that should
have worked here) — the skip fixes the symptom, not that root cause, so it's
still worth a look if it keeps happening.

**RESOLVED AND VERIFIED IN AVID 2026-08-06: cuts define shots; markers only
name them.** The marker-splitting feature was REMOVED — real-Avid testing
showed the user's markers sit mid-shot as labels, so marker boundaries chopped
real clips into half-shots that grabbed duplicate media ("2 of each clip").
Shots are one per V1 EDL event again, which covers the original complaint
because the VFX toolkit edl preset reports through-edits (cuts with
continuing source timecode) as separate events. Also recorded in HANDOFF.md
as a hard-won fact: **CreateSubClip IGNORES explicit head_frame/end_frame
spans** (asked for 267 frames, got the full 624-frame clip, six of six times)
— a mid-clip segment cannot be exported via this RPC, so do not rebuild
marker-splitting without a different bounding mechanism.

The naming rules survive and are ALSO confirmed working in the same retest
(3 shots, no duplicates, `_pl01`/`_pl02`/`_pl03` all correct): V1 gains
`_pl01` when its marker lacks it (`withPlateSuffix()`), and upper-plate
fallbacks REPLACE the base's trailing `_plNN` rather than appending
(`plateNameForTrack()` — `_pl01_pl02` was reported and fixed before this
retest). Both in `src/utils/api/edlPlan.mjs`.

**Suspect any remaining "can't be done" claim.** Three fell this session — the
per-track fan, `DoCommand` being denied to panels (it was a missing manifest
scope), and marks being unreadable (they're in the mob columns). Retest before
designing around a limitation.

**There is now a full distribution pipeline — read `docs/DISTRIBUTION.md`
before touching any of it.** Built 2026-08-05, modelled on DifferenceEngine's.
Summary of what exists and what it changed:

- **The panel UI can update over the air** without re-signing the `.avpi`. The
  helper proxies a hosted build (`service/routers/ui_proxy.py`) onto
  `localhost:8010`, because the manifest is SIGNED — `url` and `allowedDomains`
  live inside it.
- **Point it at the direct `workers.dev` origin, never the custom domain.**
  `aebridge.andrewcoheneditor.com` serves Cloudflare's `challenge-platform`
  script, which Avid's WebView cannot complete. DE documents the same trap.
  **RESOLVED 2026-08-06: the workers.dev route is live** —
  `ae-bridge.andrewcohenvfx.workers.dev` returns `200` and serves the current
  Git-connected build (checked against `wrangler deployments list`, not a
  stale cache). `ota/AEBridgeLauncher.sh` now **defaults**
  `AEBRIDGE_UI_ORIGIN` to that origin (verified proxying end-to-end on a
  throwaway local helper instance); set it to the empty string to opt back
  out to the bundled local UI.
- **AEBridge's hosted UI is a Worker with a static Assets binding, not a Pages
  project** (that is DE). Hence `wrangler.jsonc` here, and Git-connected
  Cloudflare Workers Builds rather than a GitHub Action.
- **ffprobe is gone**, replaced by `native/aebridge-probe.swift` (AVFoundation).
  Bundling FFmpeg meant GPL + dylib-linked + single-arch. See DISTRIBUTION.md
  for the edit-list trap that makes stored-sample counting wrong.
- **Helper releases:** tag `helper-v*` → `.github/workflows/release-helper.yml`
  builds, signs and notarizes both arches into `acohenvfx/AE_Bridge_Releases`.
  All 7 repo secrets are set. `ota/AEBridgeLauncher.sh` verifies SHA-256 **and**
  Developer ID Team ID before installing anything.
- **DMG:** `installer/make-dmg.sh` + `installer/app-main.sh`. Installs the
  helper, launcher, launchd job and the `.avpi` (one admin prompt, for
  `/Library` only). **Rebuilt 2026-08-06 to match ElementalBender's and
  DifferenceEngine's installers**: native welcome dialog and Cocoa progress
  window instead of a Terminal transcript, an app icon, and an **Uninstall
  AEBridge.app** shipped beside it. `installer/` now mirrors their four-file
  layout exactly. All three artifacts (installer, uninstaller, DMG) are
  notarized and stapled.

**Two lessons from that work worth not relearning:**

- **Run the frozen bundle, don't just build it.** `/healthz` 404'd in the
  PyInstaller app because a Starlette `Mount` at `/` was registered before the
  route, and a Mount at `/` matches everything. It only reproduces once
  `dist/html` exists — a release install, never dev — so it survived to the
  first frozen build. The installer polls `/healthz`, so every successful
  install would have reported failure.
- **PyInstaller thins bundled Mach-O binaries to the target arch.** A CI check
  demanding a universal probe inside the bundle failed the first release for no
  reason. Each arch ships its own asset; the probe only needs to match its own
  bundle.

**DONE 2026-08-06 (later same day, after the distribution pipeline work):
range auto-solo, scratch auto-select, Probe commands button removed.**
Implemented but **NOT YET RUN IN AVID** — test these three first:

- **Range auto-solo** (`s.autoGrabRange` in `src/store/toolState.js`, default
  ON). Mirrors the existing single-shot `maybeAutoGrab()` but for the range
  flow: `maybeAutoGrabRange()` in `AEBridgePanel.vue` watches
  `GetMobTrackInfo` and, the moment the user manually solos the next needed
  track in Avid, automatically fires `doGrabTrackAcrossRange()` for every
  shot in the marked range — no more clicking "Grab V<n> for all shots" by
  hand each time. Guarded against double-firing with the single-shot
  autoGrab flow (`if (this.s.stack.length) return`). This is a **passive
  watch-and-grab**, not a DoCommand-driven solo — the parked/broken
  DoCommand track-toggle approach was deliberately NOT revived. UI checkbox:
  "Auto-grab" next to the range shot list.
- **Scratch auto-select on Send** (`s.autoSelectScratch`, default ON).
  `selectScratchAfterSend()` runs after both `doSend()` and `doSendRange()`
  succeed; best-effort call to `tl.selectScratchSubclips()`, appends a
  "Selected N scratch subclip(s) — press Delete in Avid to clear them." note
  to `s.message`. **Never deletes anything itself** — MCAPI has no
  delete-mob RPC at all, so this is the closest thing to cleanup that's
  actually possible; the human still presses Delete. UI checkbox:
  "Auto-select on Send" in Diagnostics.
- **Probe commands button removed** from Diagnostics per explicit
  instruction — it was a debug leftover. `doProbeCommands()`, the `probing`
  state, and the button are gone from `AEBridgePanel.vue`. **Not removed:**
  `tl.probeCommands()` itself in `timeline.js` — it's a real dependency of
  `getTrackCommandMap()`, which the still-present **"Try auto-solo"** button
  (`restoreTrackEnableState`) calls directly.

`UI_BUILD` is now `2026-08-06.5 · remove Probe commands button`.

**Likely next tasks — confirm priority with the user first:**
1. **Test range auto-solo and scratch auto-select against real Avid** — both
   are implemented and unit-reasoned but have never been run against a live
   sequence. Do this before anything else below.
2. **Why `frame_count` reads 0** for some shots (see FIXED note above) — the
   validation gate no longer blocks on it, but the root cause in `grabShot()`
   is still unexplained.
3. **A real Avid return through the native probe** — return-validation itself
   (rate/resolution/frame-count check on the AE render) is still unverified
   end to end; the probe's numbers were checked against ffprobe on existing
   files, not through a live Send → render → Import round trip.
4. ~~Enable the `workers.dev` Cloudflare route~~ — **DONE 2026-08-06**, OTA UI
   updates are now wired up by default (`AEBRIDGE_UI_ORIGIN` in
   `ota/AEBridgeLauncher.sh`). Worth a real install to confirm the proxy
   behaves the same inside the actual launchd-run helper, not just the
   throwaway instance this was checked against.
5. ~~Cut a first real (non-test) `helper-v*` release tag~~ — **DONE 2026-08-06:
   `helper-v0.0.3`**, published to `acohenvfx/AE_Bridge_Releases` with both
   architectures. Note: the `on: push: tags:` trigger did not fire for this
   tag (no run appeared after ~2 minutes of polling) — worked around with
   `gh workflow run release-helper.yml -f version=helper-v0.0.3`
   (`workflow_dispatch`), which built identically. Root cause of the missed
   auto-trigger is unknown; if a future `git push origin helper-vX` doesn't
   start a run within a minute or so, use the same dispatch workaround rather
   than re-tagging. Independently verified (not just trusting CI): downloaded
   the arm64 asset, checksum matched, `codesign --verify` passed,
   `spctl --assess` said `accepted` / `source=Notarized Developer ID`,
   `xcrun stapler validate` succeeded, and both the helper binary and the
   embedded probe are `arm64` as expected. No real DMG install exists on this
   dev machine yet, so the launcher's actual update-detection path
   (`AEBridgeLauncher.sh` comparing `version.txt` against an installed
   `helper-v0.0.1-test`) is still unverified against a live install — worth
   doing before calling OTA helper updates fully proven.
