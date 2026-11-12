// The installer name follows package.json's version so a release bump can't
// leave the beta download pointing at the previous DMG. The matching
// beta/AEBridge-<version>.dmg (+ .sha256) must be in BETA_DOWNLOADS before
// this Worker deploys, or the download 404s.
import { VERSION } from './version.mjs'

const INSTALLER_NAME = `AEBridge-${VERSION}.dmg`
const INSTALLER_KEY = `beta/${INSTALLER_NAME}`
const CHECKSUM_NAME = `${INSTALLER_NAME}.sha256`
const CHECKSUM_KEY = `beta/${CHECKSUM_NAME}`

async function betaDownload(request, env, key, name, contentType) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    })
  }

  const rangeHeader = request.headers.get('Range')
  const object = await env.BETA_DOWNLOADS.get(
    key,
    rangeHeader ? { range: request.headers } : undefined,
  )
  if (!object) return new Response('Beta installer not found', { status: 404 })

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Content-Type', contentType)
  headers.set('Content-Disposition', `attachment; filename="${name}"`)
  headers.set('Cache-Control', 'public, max-age=86400, immutable')
  headers.set('Accept-Ranges', 'bytes')
  headers.set('ETag', object.httpEtag)
  headers.set('X-Content-Type-Options', 'nosniff')

  let status = 200
  if (rangeHeader && object.range) {
    const start = object.range.offset
    const end = start + object.range.length - 1
    headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`)
    headers.set('Content-Length', String(object.range.length))
    status = 206
  } else {
    headers.set('Content-Length', String(object.size))
  }

  return new Response(request.method === 'HEAD' ? null : object.body, { status, headers })
}

function betaInstaller(request, env) {
  return betaDownload(request, env, INSTALLER_KEY, INSTALLER_NAME, 'application/x-apple-diskimage')
}

function betaChecksum(request, env) {
  return betaDownload(request, env, CHECKSUM_KEY, CHECKSUM_NAME, 'text/plain; charset=utf-8')
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (pathname === '/download/beta-installer') return betaInstaller(request, env)
    if (pathname === '/download/beta-installer.sha256') return betaChecksum(request, env)
    return env.ASSETS.fetch(request)
  },
}

export { CHECKSUM_KEY, CHECKSUM_NAME, INSTALLER_KEY, INSTALLER_NAME, betaChecksum, betaInstaller }
