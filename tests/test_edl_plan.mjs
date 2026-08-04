import assert from 'node:assert/strict'

import {
  clipsForTrack,
  hasNumberedUpperTracks,
  normalizedVideoTrack,
  preferredEdlSetting,
} from '../src/utils/api/edlPlan.mjs'

assert.equal(preferredEdlSetting(['Default', 'CMX 3600']), 'CMX 3600')
assert.equal(preferredEdlSetting(['Facility EDL']), 'Facility EDL')
assert.equal(normalizedVideoTrack('V'), 1)
assert.equal(normalizedVideoTrack('v2'), 2)
assert.equal(normalizedVideoTrack('A1'), null)

const clips = [
  { track: 'V', clip_name: 'base' },
  { track: 'V2', clip_name: 'matte' },
  { track: 'V5', clip_name: 'foreground' },
  { track: 'A1', clip_name: 'audio' },
]
assert.deepEqual(clipsForTrack(clips, 1).map((clip) => clip.clip_name), ['base'])
assert.deepEqual(clipsForTrack(clips, { number: 2 }).map((clip) => clip.clip_name), ['matte'])
assert.deepEqual(clipsForTrack(clips, 5).map((clip) => clip.clip_name), ['foreground'])
assert.equal(hasNumberedUpperTracks(clips), true)
assert.equal(hasNumberedUpperTracks([{ track: 'V' }]), false)

console.log('EDL PLAN TESTS PASSED')
