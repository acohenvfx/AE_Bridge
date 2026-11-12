import assert from 'node:assert/strict'

import {
  isolationConflicts,
  soloScope,
  conflictMessage,
} from '../src/utils/api/trackIsolation.mjs'

const v = (number, enabled, numSegments = 1) => ({ number, type: 0, enabled, numSegments })
const audio = (number) => ({ number, type: 1, enabled: true, numSegments: 5 })

// V3 has clips elsewhere in the sequence but is not in the stack: it still
// conflicts, because the guard (and Avid's composite export) would include it.
const tracks = [v(1, true), v(2, false), v(3, true), v(4, true, 0), audio(1)]
assert.deepEqual(isolationConflicts(tracks, 1), [3])
assert.deepEqual(isolationConflicts(tracks, 3), [1])
// Empty tracks and audio never conflict.
assert.deepEqual(isolationConflicts([v(1, true), v(4, true, 0), audio(2)], 1), [])
assert.deepEqual(isolationConflicts(null, 1), [])

// Grab All manages the stack AND every picture track with clips.
assert.deepEqual(soloScope(tracks, [1, 2]), [1, 2, 3])
// A stack track is kept even if MCAPI reports it empty.
assert.deepEqual(soloScope([v(1, true, 0)], [1]), [1])
assert.deepEqual(soloScope(null, [2, 1]), [1, 2])

assert.match(conflictMessage(1, [3]), /V3 is also enabled and has clips/)
assert.match(conflictMessage(1, [3, 5]), /V3, V5 are also enabled and have clips/)

console.log('TRACK ISOLATION TESTS PASSED')
