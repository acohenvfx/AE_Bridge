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
  autoGrab: false,
  // The log is a diagnostic surface, not part of the normal flow — collapsed by
  // default, and the choice is remembered.
  logOpen: false
})
