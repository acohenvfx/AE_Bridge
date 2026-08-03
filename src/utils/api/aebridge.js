// AEBridge domain API — thin wrappers over the helper's /v1 routes.
import { callHelper, getJSON, postJSON } from './helperService'

export const getVersion = () => getJSON('/v1/version')
export const getAeStatus = () => getJSON('/v1/aebridge/ae')
export const listTemplates = () => getJSON('/v1/aebridge/templates')
export const listJobs = () => getJSON('/v1/aebridge/jobs')

// Opens the helper's native .aep picker (no path), or re-registers a remembered
// path (path given) to get a fresh token without a dialog.
export const pickProject = (path) =>
  path
    ? postJSON('/v1/aebridge/pick-project?path=' + encodeURIComponent(path))
    : callHelper('/v1/aebridge/pick-project', { method: 'POST' }, { dialog: true })

// Opens a native 'save new .aep' dialog, or re-registers a remembered path.
export const newProject = (path) =>
  path
    ? postJSON('/v1/aebridge/new-project?path=' + encodeURIComponent(path))
    : callHelper('/v1/aebridge/new-project', { method: 'POST' }, { dialog: true })

export const clearJobs = (all = false) =>
  postJSON('/v1/aebridge/jobs/clear' + (all ? '?all=true' : ''))
// Move a job to `error` so "Clear finished" will sweep it up.
export const cancelJob = (jobId) => postJSON(`/v1/aebridge/jobs/${jobId}/cancel`)
// Hard reset: drop every job whatever its state, and forget which renders were
// imported. Files on disk are untouched.
export const hardReset = () => postJSON('/v1/aebridge/reset')
// Everything in the shared render folder — including extra versions AE emitted
// from one comp, which the per-job watcher never sees.
export const listRenders = () => getJSON('/v1/aebridge/renders')
export const markRenderImported = (path) =>
  postJSON('/v1/aebridge/renders/imported', { path })

// Parse an EDL the panel exported (helper reads the file, returns clip events).
export const parseEdl = (edlPath, recIn, recOut, fps) =>
  postJSON('/v1/aebridge/parse-edl', {
    edl_path: edlPath,
    rec_in: recIn || null,
    rec_out: recOut || null,
    fps: fps || 24
  })

export const plateExists = (name) =>
  getJSON('/v1/aebridge/plate-exists?name=' + encodeURIComponent(name || ''))
export const prepare = (name) => postJSON('/v1/aebridge/prepare', { name: name || null })
export const send = (payload) => postJSON('/v1/aebridge/send', payload)
export const swap = (jobId) => postJSON(`/v1/aebridge/return/${jobId}/swap`)
export const validateReturn = (jobId) => postJSON(`/v1/aebridge/return/${jobId}/validate`)
export const validateRender = (jobId, path) =>
  postJSON(`/v1/aebridge/return/${jobId}/validate-render`, { path })
// Panel does the MCAPI ImportFile itself; this just records state on the helper.
export const markImported = (jobId, targetBin) =>
  postJSON(`/v1/aebridge/return/${jobId}/imported`, { target_bin: targetBin || null })
