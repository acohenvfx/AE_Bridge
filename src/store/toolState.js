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
  sourceHandles: true, // default: pull handles from the source clip (uncheck = legacy sequence grab)
  sending: false,
  message: ''
})
