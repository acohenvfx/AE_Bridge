// Copies the built .avpi to Avid's plugins folder (macOS). Use --run to execute.
import { existsSync, copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const AVPI = resolve(ROOT, 'dist/AEBridge.avpi')
const PLUGINS = '/Library/Application Support/Avid/PanelSDKPlugins'

if (!process.argv.includes('--run')) {
  console.log(`dry run. would copy ${AVPI} -> ${PLUGINS}/. pass --run to execute.`)
  process.exit(0)
}
if (!existsSync(AVPI)) {
  console.error('dist/AEBridge.avpi missing — run `yarn build:panel` first')
  process.exit(1)
}
if (!existsSync(PLUGINS)) {
  console.error(`Avid plugins folder not found: ${PLUGINS} (is Media Composer installed?)`)
  process.exit(1)
}
mkdirSync(PLUGINS, { recursive: true })
const dest = resolve(PLUGINS, basename(AVPI))
copyFileSync(AVPI, dest)
console.log(`installed -> ${dest}\nRestart Media Composer, then Tools -> AEBridge.`)
