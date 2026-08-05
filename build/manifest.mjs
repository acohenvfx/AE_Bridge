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

// The helper always runs locally, so its origins must stay allowed no matter
// where the UI itself is served from — a remotely-hosted panel still calls
// 127.0.0.1:8010 for every filesystem/AE operation. An earlier version of the
// custom branch REPLACED the list with just the remote host, which would have
// cut the panel off from its own helper.
const HELPER_DOMAINS = ['localhost:8010', '127.0.0.1:8010']

let url, allowedDomains
if (custom) {
  url = custom
  const host = new URL(custom).host
  allowedDomains = [host, ...HELPER_DOMAINS.filter((d) => d !== host)]
} else if (isRelease) {
  url = 'http://localhost:8010/app'
  allowedDomains = ['localhost:8010', '127.0.0.1:8010']
} else {
  // Cache-bust the dev URL. Avid's WebView caches the bundle on disk and keeps
  // serving it across panel closes AND Media Composer restarts — so after a
  // rollback it will happily keep running the newer code. A different query
  // string is a different cache key, which is the only reliable way to force a
  // fresh fetch. Query params don't affect allowedDomains (host:port only).
  const bust = process.env.AEB_CACHE_BUST || new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  url = `http://localhost:3010/app?v=${bust}`
  allowedDomains = ['localhost:3010', '127.0.0.1:3010', 'localhost:8010', '127.0.0.1:8010']
}

// PANEL_SUFFIX builds a SEPARATE, co-installable panel (its own manifest name,
// menu item and window) rather than replacing the normal one. Avid keys a panel
// off `name`, so a suffixed build sits beside the working AEBridge in Tools
// instead of overwriting it — which is what you want when pointing a throwaway
// build at a different URL to test something.
const suffix = (process.env.PANEL_SUFFIX || '').trim()
const slug = suffix ? suffix.toLowerCase().replace(/[^a-z0-9]/g, '') : ''
const label = suffix ? `AEBridge ${suffix}` : 'AEBridge'

const manifest = {
  category: 'suite-plugin',
  name: slug ? `com.acohenvfx.aebridge${slug}` : 'com.acohenvfx.aebridge',
  version: pkg.version || '0.0.1',
  displayName: label,
  description:
    'One-click round-trip between Avid Media Composer and After Effects for temp titles, graphics, and quick element comps.',
  // 'command' scope covers GetListOfCommands / DoCommand / IsCommandsEnabled.
  // These returned code=7 (access denied) before the scope was declared here —
  // if they now work, the panel can drive track enable itself and the
  // multi-pass stack grab collapses into one button.
  usesApi: [
    'avid.mediacomposer.general',
    'avid.mediacomposer.timelineEditing',
    'avid.mediacomposer.command',
  ],
  subscribesToChannels: [],
  entitlements: [],
  companyPrefix: 'acohenvfx',
  appShortName: slug ? `aebridge${slug}` : 'aebridge',
  uiItems: [
    {
      type: 'dropdown',
      menuName: 'Tools',
      id: slug ? `aebridge-${slug}-panel` : 'aebridge-panel',
      displayText: label,
      windowTitle: label,
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
