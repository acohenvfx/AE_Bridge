import { MCAPIClient } from '~/utils/grpc-web/MCAPI_grpc_web_pb.js'

const VERBOSE_MCAPI_STORAGE_KEY = 'aebridge.verboseMcapiLogging'

let cachedGateway = null
let cachedClient = null

export function isVerboseMcapiLoggingEnabled() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(VERBOSE_MCAPI_STORAGE_KEY) === '1'
  } catch (_e) {
    return false
  }
}

export function setVerboseMcapiLoggingEnabled(enabled) {
  if (typeof window === 'undefined') return
  try {
    if (enabled) window.localStorage.setItem(VERBOSE_MCAPI_STORAGE_KEY, '1')
    else window.localStorage.removeItem(VERBOSE_MCAPI_STORAGE_KEY)
  } catch (_e) {
    /* ignore */
  }
}

// In-memory ring buffer so logs are visible in the panel (Avid's WebView has no
// reachable console). Always captures; console output is gated by the verbose flag.
const _logBuffer = []
const _LOG_CAP = 900

function _fmt(detail) {
  if (detail === undefined || detail === '') return ''
  if (typeof detail === 'string') return detail
  try { return JSON.stringify(detail) } catch (_e) { return String(detail) }
}

// How far back _push looks for an identical entry to collapse into. One shot
// poll tick emits ~6 lines (getViewerMobs / getOpenProjectInfo / mob columns,
// requests and results), so this comfortably spans a tick.
const _REPEAT_WINDOW = 12

function _push(kind, label, detail) {
  const t = new Date().toLocaleTimeString()
  const d = _fmt(detail)
  // Collapse repeats. The shot poll logs the SAME viewer-mobs/columns payload
  // every ~2s, which turned the buffer over in about two minutes and evicted
  // the lines that matter (a grab's `plate name` / `marked range`) before
  // anyone could hit Copy — exactly what stalled a live diagnosis on
  // 2026-08-06. An identical entry within the window just bumps a ×count and
  // refreshes the timestamp; anything that CHANGES (playhead moved, real
  // operation) still logs a new line.
  for (let i = _logBuffer.length - 1, seen = 0; i >= 0 && seen < _REPEAT_WINDOW; i -= 1, seen += 1) {
    const e = _logBuffer[i]
    if (e.kind === kind && e.label === label && e.detail === d) {
      e.n = (e.n || 1) + 1
      e.t = t
      return
    }
  }
  _logBuffer.push({ t, kind, label, detail: d })
  if (_logBuffer.length > _LOG_CAP) _logBuffer.shift()
}

export function getMcapiLog() {
  return _logBuffer.slice()
}

export function clearMcapiLog() {
  _logBuffer.length = 0
}

export function logMcapiVerbose(label, detail) {
  _push('info', label, detail)
  if (!isVerboseMcapiLoggingEnabled()) return
  // eslint-disable-next-line no-console
  console.log(`[MCAPI] ${label}`, detail !== undefined ? detail : '')
}

export function logMcapiVerboseError(label, err) {
  _push('error', label, (err && err.message) || err)
  if (!isVerboseMcapiLoggingEnabled()) return
  // eslint-disable-next-line no-console
  console.error(`[MCAPI] ${label}`, err)
}

export function getGatewayServerAddress() {
  if (typeof mcapi === 'undefined') return null
  try {
    return mcapi.getGatewayServerAddress()
  } catch (_e) {
    return null
  }
}

export function getAccessTokenMetadata() {
  if (typeof mcapi === 'undefined') return { accessToken: null }
  try {
    return { accessToken: mcapi.getAccessToken() }
  } catch (_e) {
    return { accessToken: null }
  }
}

export function getMcapiClient() {
  const gateway = getGatewayServerAddress()
  if (!gateway) return null

  if (!cachedClient || cachedGateway !== gateway) {
    cachedGateway = gateway
    cachedClient = new MCAPIClient(gateway, null, null)
    logMcapiVerbose('gateway client (re)created', { gateway })
  }

  return cachedClient
}

/**
 * Promise wrapper for unary MCAPI calls.
 * Used by openBin, selectMobsInBin, and other unary RPCs that lack streaming helpers.
 */
export function callUnary(
  client,
  methodName,
  request,
  metadata,
  timeoutMs = 30000
) {
  logMcapiVerbose(`unary ${methodName}`, 'request')
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + timeoutMs)
    client[methodName](request, { ...metadata, deadline }, (err, response) => {
      if (err) {
        logMcapiVerboseError(`unary ${methodName}`, err)
        const code = typeof err.code !== 'undefined' ? `code=${err.code}` : ''
        const message =
          err && err.message ? err.message : `MCAPI ${methodName} failed`
        reject(new Error([code, message].filter(Boolean).join(' ')))
        return
      }
      logMcapiVerbose(`unary ${methodName}`, 'ok')
      resolve(response)
    })
  })
}

/**
 * Wrap a gRPC-Web server stream with an automatic timeout.
 * If no 'end' or 'error' fires within `timeoutMs`, the stream is cancelled
 * and the 'error' handler receives a timeout error.
 */
export function streamWithTimeout(stream, timeoutMs = 30000) {
  const timer = setTimeout(() => {
    logMcapiVerboseError('stream timeout', `cancelled after ${timeoutMs}ms`)
    stream.cancel()
  }, timeoutMs)
  const origOn = stream.on.bind(stream)
  stream.on = function wrappedOn(event, handler) {
    if (event === 'end' || event === 'error') {
      origOn(event, function () {
        clearTimeout(timer)
        handler.apply(this, arguments)
      })
    } else {
      origOn(event, handler)
    }
    return stream
  }
  return stream
}
