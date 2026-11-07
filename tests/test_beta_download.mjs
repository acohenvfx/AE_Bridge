import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import worker, { CHECKSUM_KEY, INSTALLER_KEY, INSTALLER_NAME } from '../worker/index.mjs'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
assert.equal(INSTALLER_NAME, `AEBridge-${pkg.version}.dmg`)
assert.equal(INSTALLER_KEY, `beta/${INSTALLER_NAME}`)

function fakeObject(range = null) {
  const body = new Uint8Array([1, 2, 3, 4])
  return {
    body,
    size: 4,
    range,
    httpEtag: '"beta-etag"',
    writeHttpMetadata() {},
  }
}

const seen = []
const env = {
  BETA_DOWNLOADS: {
    async get(key, options) {
      seen.push({ key, options })
      return fakeObject(options ? { offset: 1, length: 2 } : null)
    },
  },
  ASSETS: {
    async fetch() { return new Response('asset') },
  },
}

const get = await worker.fetch(new Request('https://example.com/download/beta-installer'), env)
assert.equal(get.status, 200)
assert.equal(get.headers.get('Content-Disposition'), `attachment; filename="${INSTALLER_NAME}"`)
assert.equal(get.headers.get('Content-Type'), 'application/x-apple-diskimage')
assert.equal(seen[0].key, INSTALLER_KEY)

const head = await worker.fetch(new Request('https://example.com/download/beta-installer', { method: 'HEAD' }), env)
assert.equal(head.status, 200)
assert.equal(await head.text(), '')

const range = await worker.fetch(new Request('https://example.com/download/beta-installer', { headers: { Range: 'bytes=1-2' } }), env)
assert.equal(range.status, 206)
assert.equal(range.headers.get('Content-Range'), 'bytes 1-2/4')
assert.equal(range.headers.get('Content-Length'), '2')

const post = await worker.fetch(new Request('https://example.com/download/beta-installer', { method: 'POST' }), env)
assert.equal(post.status, 405)

const checksum = await worker.fetch(new Request('https://example.com/download/beta-installer.sha256'), env)
assert.equal(checksum.status, 200)
assert.equal(checksum.headers.get('Content-Type'), 'text/plain; charset=utf-8')
assert.equal(seen.at(-1).key, CHECKSUM_KEY)

const asset = await worker.fetch(new Request('https://example.com/app'), env)
assert.equal(await asset.text(), 'asset')

console.log('BETA DOWNLOAD TESTS PASSED')
