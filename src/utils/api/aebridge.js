// AEBridge domain API — thin wrappers over the helper's /v1 routes.
import { callHelper, getJSON, postJSON } from './helperService'

export const getVersion = () => getJSON('/v1/version')
export const getAeStatus = () => getJSON('/v1/aebridge/ae')
export const listTemplates = () => getJSON('/v1/aebridge/templates')
export const listJobs = () => getJSON('/v1/aebridge/jobs')

// Opens the helper's native .aep picker (waits on the user).
export const pickProject = () =>
  callHelper('/v1/aebridge/pick-project', { method: 'POST' }, { dialog: true })

// Opens a native 'save new .aep' dialog (name + location).
export const newProject = () =>
  callHelper('/v1/aebridge/new-project', { method: 'POST' }, { dialog: true })

export const clearJobs = (all = false) =>
  postJSON('/v1/aebridge/jobs/clear' + (all ? '?all=true' : ''))

export const prepare = (name) => postJSON('/v1/aebridge/prepare', { name: name || null })
export const send = (payload) => postJSON('/v1/aebridge/send', payload)
export const swap = (jobId) => postJSON(`/v1/aebridge/return/${jobId}/swap`)
// Panel does the MCAPI ImportFile itself; this just records state on the helper.
export const markImported = (jobId, targetBin) =>
  postJSON(`/v1/aebridge/return/${jobId}/imported`, { target_bin: targetBin || null })
