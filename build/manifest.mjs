// Generates dist/app/avid-manifest.json + copies the icon.
// Profiles:
//   dev (default)        -> url http://localhost:3010/app (Nuxt dev + helper :8010)
//   release (AEB_RELEASE=1) -> url http://localhost:8010/app (helper serves the UI)
//   custom (APP_URL=...) -> honored as-is
import { readFileSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))

const isRelease = process.env.AEB_RELEASE === '1'
const custom = process.env.APP_URL

let url, allowedDomains
if (custom) {
  url = custom
  const host = new URL(custom).host
  allowedDomains = [host]
} else if (isRelease) {
  url = 'http://localhost:8010/app'
  allowedDomains = ['localhost:8010', '127.0.0.1:8010']
} else {
  url = 'http://localhost:3010/app'
  allowedDomains = ['localhost:3010', '127.0.0.1:3010', 'localhost:8010', '127.0.0.1:8010']
}

const manifest = {
  category: 'suite-plugin',
  name: 'com.acohenvfx.aebridge',
  version: pkg.version || '0.0.1',
  displayName: 'AEBridge',
  description:
    'One-click round-trip between Avid Media Composer and After Effects for temp titles, graphics, and quick element comps.',
  usesApi: ['avid.mediacomposer.general', 'avid.mediacomposer.timelineEditing'],
  subscribesToChannels: [],
  entitlements: [],
  companyPrefix: 'acohenvfx',
  appShortName: 'aebridge',
  uiItems: [
    {
      type: 'dropdown',
      menuName: 'Tools',
      id: 'aebridge-panel',
      displayText: 'AEBridge',
      windowTitle: 'AEBridge',
      icon: 'static/application.svg',
      url
    }
  ],
  windowSize: {
    initial: { width: '900', height: '700' },
    minimum: { width: '700', height: '520' }
  },
  targetHosts: ['MediaComposer'],
  allowedDomains,
  windowStyle: 'floating',
  singleton: true
}

const outDir = resolve(ROOT, 'dist/app')
mkdirSync(resolve(outDir, 'static'), { recursive: true })
writeFileSync(resolve(outDir, 'avid-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
copyFileSync(resolve(ROOT, 'src/static/application.svg'), resolve(outDir, 'static/application.svg'))

console.log(`manifest: ${isRelease ? 'release' : custom ? 'custom' : 'dev'} profile -> ${url}`)
console.log(`  wrote ${resolve(outDir, 'avid-manifest.json')}`)
