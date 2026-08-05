// Zips dist/app/ (manifest + static icon) into dist/AEBridge_<date>.avpi.
// Thin AVPI: manifest + icon only; the UI is served by the helper.
import { readFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const APP = resolve(ROOT, 'dist/app')
const DIST = resolve(ROOT, 'dist')

if (!existsSync(resolve(APP, 'avid-manifest.json'))) {
  console.error('dist/app/avid-manifest.json missing — run build/manifest.mjs first')
  process.exit(1)
}

// Keep a suffixed (co-installable) build in its OWN file — otherwise a
// throwaway probe build would overwrite dist/AEBridge.avpi, which is exactly
// what `yarn build:copy` installs as the real panel.
const suffix = (process.env.PANEL_SUFFIX || '').trim()
const slug = suffix ? suffix.replace(/[^A-Za-z0-9]/g, '') : ''
const base = slug ? `AEBridge_${slug}` : 'AEBridge'

const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
// Build in the OS temp dir first: `zip` uses a temp-file rename that some
// mounted filesystems (virtiofs/FUSE) reject. Then copy into dist/ (copy works).
const tmpOut = resolve(tmpdir(), `${base}_${stamp}_${process.pid}.avpi`)
if (existsSync(tmpOut)) rmSync(tmpOut)

execFileSync('zip', ['-r', '-X', tmpOut, 'avid-manifest.json', 'static'], { cwd: APP, stdio: 'inherit' })

mkdirSync(DIST, { recursive: true })
const out = resolve(DIST, `${base}_${stamp}.avpi`)
copyFileSync(tmpOut, out)
copyFileSync(tmpOut, resolve(DIST, `${base}.avpi`))
rmSync(tmpOut)

const size = readFileSync(out).length
console.log(`built ${out} (${size} bytes) + alias dist/${base}.avpi`)
