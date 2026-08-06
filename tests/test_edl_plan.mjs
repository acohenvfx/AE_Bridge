import assert from 'node:assert/strict'

import {
  clipsForTrack,
  hasNumberedUpperTracks,
  normalizedVideoTrack,
  pickClipForSegment,
  plateNameForTrack,
  preferredEdlSetting,
  withPlateSuffix,
} from '../src/utils/api/edlPlan.mjs'

assert.equal(preferredEdlSetting(['Default Change List', 'VFX toolkit edl']), 'VFX toolkit edl')
assert.equal(preferredEdlSetting(['Default Change List', 'SHOTGUN EDL VFX']), '')
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

// An upper-track plate that starts partway INTO the shot still belongs to it
// (2026-08-04 report: "analyzing a range containing a stack, only V1 and V2
// are recognized"). Point containment of the segment's first frame dropped
// these; overlap keeps them.
{
  const seg = [1000, 2000]
  // starts late — the classic stack plate over the middle of a longer V1 clip
  assert.equal(pickClipForSegment([{ in: 1400, out: 1800, id: 'late' }], ...seg).id, 'late')
  // ends early
  assert.equal(pickClipForSegment([{ in: 800, out: 1200, id: 'early' }], ...seg).id, 'early')
  // fully covers
  assert.equal(pickClipForSegment([{ in: 900, out: 2100, id: 'covers' }], ...seg).id, 'covers')
  // no overlap at all, on either side, is still correctly excluded
  assert.equal(pickClipForSegment([{ in: 2000, out: 2500 }], ...seg), null)
  assert.equal(pickClipForSegment([{ in: 500, out: 1000 }], ...seg), null)
  assert.equal(pickClipForSegment([], ...seg), null)
  // when several overlap, the one covering the segment's start wins, so the
  // ordinary single-clip case resolves exactly as the old point test did
  assert.equal(
    pickClipForSegment(
      [{ in: 1500, out: 2000, id: 'later' }, { in: 900, out: 1500, id: 'covers-start' }],
      ...seg
    ).id,
    'covers-start'
  )
}

// V1's marker being just the bare shot name (2026-08-04 report) must get
// _pl01 appended automatically, matching how upper plates already carry
// their track number.
assert.equal(withPlateSuffix('vfx_010_0010', 1), 'vfx_010_0010_pl01')
assert.equal(withPlateSuffix('vfx_010_0010', 2), 'vfx_010_0010_pl02')
// A marker that already ends in _plNN (seen for real in this project's own
// test sequence) is left alone, not doubled up.
assert.equal(withPlateSuffix('testCAM_101_001_0140_pl01', 1), 'testCAM_101_001_0140_pl01')
assert.equal(withPlateSuffix('vfx_010_0010_PL03', 1), 'vfx_010_0010_PL03')
assert.equal(withPlateSuffix('', 1), '_pl01')

// An upper plate's fallback name REPLACES the base's trailing _plNN with its
// own (2026-08-06 report: V2 came out `<shot>_pl01_pl02` because the V1
// marker comment already carried _pl01 and the suffix was appended blindly).
assert.equal(plateNameForTrack('testCAM_101_001_0140_pl01', 2), 'testCAM_101_001_0140_pl02')
assert.equal(plateNameForTrack('testCAM_101_001_0140_pl01', 3), 'testCAM_101_001_0140_pl03')
// A bare base (no suffix) still just gains the track's own.
assert.equal(plateNameForTrack('vfx_010_0010', 2), 'vfx_010_0010_pl02')
// Case-insensitive strip, consistent with withPlateSuffix's detection.
assert.equal(plateNameForTrack('shot_PL01', 2), 'shot_pl02')

console.log('EDL PLAN TESTS PASSED')
