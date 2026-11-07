export const FULL_SUPPORT_MIN = [2025, 12, 1]
export const COMMAND_AUTOMATION_MIN = [2025, 6, 0]

export function parseMediaComposerVersion(value) {
  const match = String(value || '').match(/(\d{2,4})\.(\d+)(?:\.(\d+))?/)
  if (!match) return null
  let major = Number(match[1])
  if (major >= 20 && major < 100) major += 2000
  return [major, Number(match[2]), Number(match[3] || 0)]
}

export function versionAtLeast(value, minimum) {
  const parsed = Array.isArray(value) ? value : parseMediaComposerVersion(value)
  if (!parsed) return false
  for (let i = 0; i < 3; i += 1) {
    if (parsed[i] > minimum[i]) return true
    if (parsed[i] < minimum[i]) return false
  }
  return true
}

export function hostCapabilities(appVersion) {
  return {
    fullSupport: versionAtLeast(appVersion, FULL_SUPPORT_MIN),
    commandAutomation: versionAtLeast(appVersion, COMMAND_AUTOMATION_MIN),
  }
}
