import { preferredEdlSetting } from './edlPlan.mjs'
import { EDL_PRESET_ID, EDL_PRESET_NAME, EDL_PRESET_XML } from './edlPreset.mjs'

// Share concurrent requests, but recheck on the next export: Avid settings are
// session-local and can disappear when the editor switches user profiles.
export function createEdlSettingResolver({ listSettings, loadSetting }) {
  let pending = null
  return function ensureEdlSetting() {
    if (!pending) {
      pending = (async () => {
        try {
          const existing = preferredEdlSetting(await listSettings())
          if (existing) return existing
          await loadSetting(EDL_PRESET_ID, EDL_PRESET_XML)
          // ExportEDL silently falls back to Default EDL for an unknown name.
          // Verify the loaded preset before allowing any export to proceed.
          const loaded = preferredEdlSetting(await listSettings())
          if (!loaded) throw new Error('Avid did not list the preset after loading it')
          return loaded
        } catch (cause) {
          const error = new Error(
            'AE Bridge could not load its bundled Avid List Tool preset "' +
            EDL_PRESET_NAME + '". Reopen the panel and retry Analyze. ' +
            'If this continues, send this message to support. Details: ' +
            String((cause && cause.message) || cause)
          )
          error.code = 'AEB_EDL_PRESET'
          throw error
        }
      })().finally(() => { pending = null })
    }
    return pending
  }
}
