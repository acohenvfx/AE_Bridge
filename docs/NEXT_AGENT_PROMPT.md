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
render → import back to bin, all confirmed on real MXF media.

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

**Suspect any remaining "can't be done" claim.** Three fell this session — the
per-track fan, `DoCommand` being denied to panels (it was a missing manifest
scope), and marks being unreadable (they're in the mob columns). Retest before
designing around a limitation.

**Likely next tasks — confirm priority with the user first:**
1. **Scratch-bin cleanup.** `AEBridge_Scratch` gains a subclip per plate per
   pass and a range batch fills it fast. No delete-mob API; needs real
   investigation. Most likely daily irritation.
2. **Return validation** (`ffprobe` rate/res/frame-count) is still stubbed — the
   guardrail against cutting in a wrong-rate temp.
3. **Auto-solo**, if manual track toggling grates. One click of **Try auto-solo**
   (Diagnostics) reveals whether it's a focus problem or the wrong flag.
