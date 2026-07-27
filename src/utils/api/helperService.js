// Fetch wrapper for the AEBridge helper.
//
// In release the panel is served by the helper (same-origin), so HELPER_URL is
// '' and paths are relative. In dev the panel runs on :3010 and talks to the
// helper on :8010; if the primary base fails we retry on the localhost twin.
const PRIMARY = process.env.HELPER_URL || ''
const FALLBACK = PRIMARY
  ? PRIMARY.replace('127.0.0.1', 'localhost')
  : ''

const DEFAULT_TIMEOUT = 15000
const DIALOG_TIMEOUT = 5 * 60 * 1000 // native pickers wait on the user

async function once(base, path, opts, timeout) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(base + path, {
      ...opts,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
    })
    const ct = res.headers.get('content-type') || ''
    const body = ct.includes('json') ? await res.json() : await res.text()
    if (!res.ok) {
      const msg = (body && body.detail) || res.statusText || 'request failed'
      throw new Error(msg)
    }
    return body
  } finally {
    clearTimeout(t)
  }
}

export async function callHelper(path, opts = {}, { dialog = false } = {}) {
  const timeout = dialog ? DIALOG_TIMEOUT : DEFAULT_TIMEOUT
  try {
    return await once(PRIMARY, path, opts, timeout)
  } catch (e) {
    if (FALLBACK && FALLBACK !== PRIMARY) {
      return await once(FALLBACK, path, opts, timeout)
    }
    throw e
  }
}

export const getJSON = (path, opts) => callHelper(path, { method: 'GET', ...opts })
export const postJSON = (path, data, opts) =>
  callHelper(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined, ...opts })
