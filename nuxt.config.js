// AEBridge panel — Nuxt 2 / Vue 2 SPA.
// Dev: `yarn dev` serves on 127.0.0.1:3010; the helper API is on 8010.
// Release: `yarn generate:release` static-exports to dist/html; the helper
// serves it at localhost:8010/app (same-origin with the API).
const pkg = require('./package.json')

const isRelease = process.env.AEB_RELEASE === '1'

export default {
  // Release builds are static artifacts; disable Nuxt's repository telemetry
  // so CI never inspects or transmits project metadata.
  telemetry: false,
  ssr: false,
  target: 'static',
  srcDir: 'src/',

  head: {
    title: 'AEBridge',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' }
    ]
  },

  css: ['~/assets/scss/style.scss'],

  env: {
    // In dev the panel talks to the helper cross-origin (3010 -> 8010).
    // In release the panel is served BY the helper, so same-origin ('').
    HELPER_URL: process.env.HELPER_URL || (isRelease ? '' : 'http://127.0.0.1:8010'),
    PANEL_VERSION: pkg.version || '0.0.1'
  },

  generate: { dir: 'dist/html' },

  // Keep generation deterministic in locked-down build runners. Nuxt 2's
  // generator briefly starts a local server; it must never bind all
  // interfaces just to produce static files.
  server: {
    host: process.env.NUXT_HOST || '127.0.0.1',
    port: Number(process.env.NUXT_PORT || 3010)
  },

  build: {
    // The generated MCAPI bindings exceed Babel's 500 KB auto-compact
    // threshold. Compact them explicitly so a healthy RC build is not logged
    // as an error-like deoptimisation warning.
    babel: { compact: true }
  }
}
