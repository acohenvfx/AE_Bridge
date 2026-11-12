import assert from 'node:assert/strict'

import {
  hostCapabilities,
  parseMediaComposerVersion,
  versionAtLeast,
} from '../src/utils/api/hostCapabilities.mjs'

assert.deepEqual(parseMediaComposerVersion('Media Composer 2025.12.1.12345'), [2025, 12, 1])
assert.deepEqual(parseMediaComposerVersion('25.12.2'), [2025, 12, 2])
assert.equal(parseMediaComposerVersion('unknown'), null)

assert.equal(versionAtLeast('2025.12.1', [2025, 12, 1]), true)
assert.equal(versionAtLeast('2025.12.0', [2025, 12, 1]), false)
assert.equal(versionAtLeast('2026.1', [2025, 12, 1]), true)

assert.deepEqual(hostCapabilities('2024.12.7'), {
  fullSupport: false,
  commandAutomation: false,
})
assert.deepEqual(hostCapabilities('2025.6'), {
  fullSupport: false,
  commandAutomation: true,
})
assert.deepEqual(hostCapabilities('2025.12.1'), {
  fullSupport: true,
  commandAutomation: true,
})

console.log('HOST CAPABILITY TESTS PASSED')
