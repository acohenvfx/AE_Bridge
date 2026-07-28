# Next-agent kickoff prompt

Paste this to the next agent/session.

---

You're continuing **AEBridge**, a standalone Avid Media Composer ↔ After Effects
round-trip panel for VFX temp plates. It lives in the `AE_Bridge` folder (Nuxt 2
/ Vue 2 panel + Python FastAPI helper on port 8010). It is its own product,
modeled on the Elemental Bender panel but with no shared engine.

**Before doing anything, read `docs/HANDOFF.md` in full**, then skim
`docs/AEBRIDGE_DESIGN.md` and `docs/PHASE_MULTIPLATE.md`. Invoke the
`avid-panel-dev` skill for EB-stack conventions.

**Current state:** the single-plate round trip works end to end in Avid (grab V1
plate → export → AE comp → render → import back to bin). The just-completed work
made the grab **V1-only**, isolated the export via **`enabled_tracks_only`** (the
critical discovery: `CreateSubClip` ignores `track_list`), took the shot name
from **V1's** marker on stacked shots, and added a **UI build stamp pill**.

**Non-negotiable facts to internalize (all in HANDOFF.md):**
- MCAPI runs in the **panel WebView**, not the helper. Timeline code =
  `src/utils/api/timeline.js`.
- `CreateSubClip` **ignores `track_list`**; only `enabled_tracks_only: true`
  isolates a track. `DoCommand`/`GetListOfCommands` are **access-denied** for
  panels (no Match Frame). Exporting a multi-track subclip **composites**.
- The helper does **not** hot-reload (restart after `service/**` edits); the
  panel does. Ports: helper 8010, dev panel 3010.
- **Bump `UI_BUILD`** in `AEBridgePanel.vue` on every UI change; the Avid WebView
  caches bundles, so the header pill is how the user confirms which build loaded.
- **You cannot verify MCAPI code yourself** — the `mcapi` global only exists in
  Avid. Write it to the EB patterns, add verbose logging via `logMcapiVerbose`,
  and iterate with the user against real Avid runs and the on-screen log. Do
  `node --check` on JS before handing back.
- **Git runs on the user's Mac**, never the sandbox (stale `.git/*.lock`). Give
  the user copy-paste git commands; don't push from here.

**Likely next tasks (confirm priority with the user first):**
1. Multi-plate / multi-track phase (`PHASE_MULTIPLATE.md`): one temp per V1 clip,
   layered comps, `_plNN` naming, one Send → N jobs. Reuse `createRawSubclip`,
   `exportEdlForTrack`, and the helper `parse-edl`. Design the enable-state UX
   around the `enabled_tracks_only` constraint.
2. Scratch-bin cleanup (`AEBridge_Scratch` accumulates; no delete API).
3. Return-side validation (`ffprobe` rate/res/frame-count is stubbed).

Start by confirming with the user what they want to tackle and whether the last
build is still behaving, then work in small, Avid-testable increments.
