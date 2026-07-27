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

const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
// Build in the OS temp dir first: `zip` uses a temp-file rename that some
// mounted filesystems (virtiofs/FUSE) reject. Then copy into dist/ (copy works).
const tmpOut = resolve(tmpdir(), `AEBridge_${stamp}_${process.pid}.avpi`)
if (existsSync(tmpOut)) rmSync(tmpOut)

execFileSync('zip', ['-r', '-X', tmpOut, 'avid-manifest.json', 'static'], { cwd: APP, stdio: 'inherit' })

mkdirSync(DIST, { recursive: true })
const out = resolve(DIST, `AEBridge_${stamp}.avpi`)
copyFileSync(tmpOut, out)
copyFileSync(tmpOut, resolve(DIST, 'AEBridge.avpi'))
rmSync(tmpOut)

const size = readFileSync(out).length
console.log(`built ${out} (${size} bytes) + alias dist/AEBridge.avpi`)
