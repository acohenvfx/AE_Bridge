// Shared, reactive tool state (Vue.observable), mirroring the EB pattern.
import Vue from 'vue'

export const aebridge = Vue.observable({
  templateId: '__blank__',
  handles: 8,
  prefix: '',
  suffix: '',
  projectMode: 'new_per_shot', // or 'existing_project'
  projectToken: null,
  projectLabel: '',
  projectPath: '', // intentionally blank; project paths stay inside the helper
  templates: [],
  jobs: [],
  helper: { online: false, version: null },
  // feature_ids from /v1/version — the panel checks these before calling a
  // route, since the helper never hot-reloads and is often the older half.
  helperFeatures: [],
  ae: { found: false, version: null },
  inAvid: false,
  avidHost: { appVersion: '', sdkVersion: '', fullSupport: false, commandAutomation: false },
  shot: null,
  shotMessage: '',
  exportSettings: [],
  exportSetting: '',
  destBin: 'AEBridge_Temps',
  sending: false,
  message: '',
  // --- plate stack (multi-pass grab) ---
  // `stack` is the PLAN read from the timeline (every video track carrying a
  // clip under the playhead). `grabbed` is what has actually been subclipped so
  // far — one entry per pass, because only the track enable state isolates a
  // track and it isolates exactly one per grab.
  stack: [],
  stackTC: '',
  // Sequence-relative frame of the analyzed playhead. Grabs use this (with
  // stackTC), not the live playhead, so scrubbing after Analyze can't export
  // a different shot's media under this stack's names.
  stackFrame: null,
  // Which track NAMES the stack — ordinarily V1, but selecting specific track
  // heads in Avid before Analyze (see trackSelection.mjs) can narrow the scan
  // to any subset, in which case the lowest one becomes the anchor. Set once
  // when a fresh (non-merge) stack is established in doAnalyze and left alone
  // on a same-playhead re-Analyze, so a later selection change can never shift
  // the anchor out from under plates already grabbed under the old one.
  stackAnchorTrack: null,
  // Horizontal batch: the sequence's marked range split into one shot per V1
  // clip, each with its own plate stack. Read-only plan for now.
  range: null,
  rangeAnalyzing: false,
  grabbed: [],
  baseName: '',
  stackShot: null,
  analyzing: false,
  grabbingTrack: null,
  // Session-only safety control: always starts OFF when the panel opens. The
  // editor can enable it after reviewing the analyzed stack, but a previous
  // session must never begin grabbing merely because a track is already soloed.
  autoGrab: false,
  // Same idea, for the range flow: watch the enable state and grab a track
  // ACROSS EVERY SHOT the moment it's soloed, instead of requiring the
  // "Grab V<n> for all shots" button each time. Like stack auto-grab, this is
  // session-only and always starts OFF.
  autoGrabRange: false,
  // MCAPI has no delete-mob RPC, so a subclip can never be removed
  // programmatically — the only lever is selecting AEBridge_Scratch's
  // subclips (selectScratchSubclips) so a human can press Delete themselves.
  // This runs that select automatically right after a successful Send, so
  // the clips a shot just finished with are already highlighted in the bin
  // instead of requiring a trip to Diagnostics -> Select scratch. It NEVER
  // deletes anything itself — see HANDOFF for why an unattended delete was
  // deliberately not built (the only mechanism available, DoCommand, already
  // proved unreliable for track-enable in this exact codebase).
  autoSelectScratch: true,
  // Open by default while the round trip is still being debugged — the log is
  // how Avid-side problems get diagnosed, and a collapsed one costs a round
  // trip every time something fails. The choice is still remembered once the
  // user collapses it. Revisit for a consumer build.
  logOpen: true,
  // Set-once preferences (handles, export preset, project mode) — collapsed by
  // default so they don't compete with the per-shot flow.
  settingsOpen: false,
  // Hard stop on the shot poll. MCAPI has no push events so the readout needs
  // polling, but the editor should be able to silence it outright.
  pollPaused: false,
  // Every job has a private render folder; extra versions remain visible and
  // importable even though the watcher matches only the first completed one.
  renders: []
})
