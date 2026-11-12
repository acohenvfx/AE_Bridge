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
const sessions = new Map()

async function ensureSession(base) {
  const key = base || '__same-origin__'
  if (!sessions.has(key)) {
    const promise = fetch(base + '/v1/session', {
      method: 'GET',
      credentials: 'include'
    }).then((res) => {
      if (!res.ok) throw new Error('could not establish an AEBridge session')
      return true
    }).catch((error) => {
      sessions.delete(key)
      throw error
    })
    sessions.set(key, promise)
  }
  return sessions.get(key)
}

async function once(base, path, opts, timeout, retrying = false) {
  if (path !== '/v1/session') await ensureSession(base)
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(base + path, {
      ...opts,
      signal: ctrl.signal,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
    })
    if (res.status === 401 && path !== '/v1/session' && !retrying) {
      sessions.delete(base || '__same-origin__')
      return once(base, path, opts, timeout, true)
    }
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
