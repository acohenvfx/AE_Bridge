// AEBridge panel — Nuxt 2 / Vue 2 SPA.
// Dev: `yarn dev` serves on 127.0.0.1:3010; the helper API is on 8010.
// Release: `yarn generate:release` static-exports to dist/html; the helper
// serves it at localhost:8010/app (same-origin with the API).
const pkg = require('./package.json')

const isRelease = process.env.AEB_RELEASE === '1'

export default {
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
    APP_URL: process.env.APP_URL || 'http://localhost:3010/app',
    PANEL_VERSION: pkg.version || '0.0.1'
  },

  generate: { dir: 'dist/html' },

  build: {
    // Nuxt 2 / webpack 4 needs the legacy OpenSSL provider on Node 17+.
    // (On Node 16 this is a no-op.)
  }
}
