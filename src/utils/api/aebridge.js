// AEBridge domain API — thin wrappers over the helper's /v1 routes.
import { callHelper, getJSON, postJSON } from './helperService'

export const getVersion = () => getJSON('/v1/version')
export const getAeStatus = () => getJSON('/v1/aebridge/ae')
export const listTemplates = () => getJSON('/v1/aebridge/templates')
export const listJobs = () => getJSON('/v1/aebridge/jobs')

// Opens the helper's native .aep picker (waits on the user).
export const pickProject = () =>
  callHelper('/v1/aebridge/pick-project', { method: 'POST' }, { dialog: true })

export const prepare = () => postJSON('/v1/aebridge/prepare')
export const send = (payload) => postJSON('/v1/aebridge/send', payload)
export const swap = (jobId) => postJSON(`/v1/aebridge/return/${jobId}/swap`)
export const importReturn = (jobId, targetBin) =>
  postJSON(`/v1/aebridge/return/${jobId}/import`, { target_bin: targetBin || null })
