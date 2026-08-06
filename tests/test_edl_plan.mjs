import assert from 'node:assert/strict'

import {
  clipsForTrack,
  hasNumberedUpperTracks,
  normalizedVideoTrack,
  pickClipForSegment,
  plateNameForTrack,
  preferredEdlSetting,
  splitClipAtMarkers,
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

// A continuous, uncut V1 clip with markers on it (the 2026-08-04 report:
// "the tool ignores the cut point even if there are markers on clips") must
// split into one segment per marker, not stay one shot.
{
  const segs = splitClipAtMarkers(1000, 2000, [1300, 1700])
  assert.deepEqual(segs, [
    { start: 1000, end: 1300, split: true },
    { start: 1300, end: 1700, split: true },
    { start: 1700, end: 2000, split: true },
  ])
}

// No markers inside the clip -> a single whole-clip segment, split: false, so
// the grab pipeline's existing useClipBounds (whole clip) path is untouched.
assert.deepEqual(splitClipAtMarkers(1000, 2000, []), [
  { start: 1000, end: 2000, split: false },
])
assert.deepEqual(splitClipAtMarkers(1000, 2000, [999, 2000, 2500]), [
  { start: 1000, end: 2000, split: false },
]) // markers exactly on a boundary, or outside the clip entirely, don't split it

// A marker exactly on an interior boundary already IS one; duplicates collapse.
assert.deepEqual(splitClipAtMarkers(1000, 2000, [1500, 1500]), [
  { start: 1000, end: 1500, split: true },
  { start: 1500, end: 2000, split: true },
])

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
