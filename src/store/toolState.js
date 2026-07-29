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
  projectPath: '', // remembered across restarts; re-registered for a fresh token
  templates: [],
  jobs: [],
  helper: { online: false, version: null },
  // feature_ids from /v1/version — the panel checks these before calling a
  // route, since the helper never hot-reloads and is often the older half.
  helperFeatures: [],
  ae: { found: false, version: null },
  inAvid: false,
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
  grabbed: [],
  baseName: '',
  stackShot: null,
  analyzing: false,
  grabbingTrack: null,
  // ON by default: Avid won't let the panel drive the track selectors (see
  // HANDOFF), so soloing is manual — and watching for it is strictly better
  // than making the user come back to the panel between each track.
  autoGrab: true,
  // The log is a diagnostic surface, not part of the normal flow — collapsed by
  // default, and the choice is remembered.
  logOpen: false,
  // Hard stop on the shot poll. MCAPI has no push events so the readout needs
  // polling, but the editor should be able to silence it outright.
  pollPaused: false,
  // Everything in the shared render folder, so extra versions of a comp are
  // visible and importable even though no job is watching for them.
  renders: []
})
