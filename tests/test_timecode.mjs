import assert from 'node:assert/strict'

import { tcToFrames, durationToFrames } from '../src/utils/api/timecode.mjs'

// The real regression (2026-08-07). Every plate AEBridge had ever grabbed
// carried `frame_count: 0` — all 19 sidecars in ~/Desktop/AEBridge/plates,
// not "occasionally" as the docs had it.
//
// Ground truth for this shot, from three independent sources that agree:
//   sidecar Start/End  00:07:45:01 -> 00:08:02:20  = 427 frames
//   Avid's Duration column                 "17:19" = 427 frames
//   the exported .mov, via aebridge-probe          = 427 frames
const FPS = 24

{
  // Avid writes durations RIGHT-ALIGNED. This is the exact value that broke it.
  assert.equal(durationToFrames('17:19', FPS), 427)

  // tcToFrames rejects it outright — two fields, not four. This is the bug in
  // one line: the old chain took this branch and never tried end−start.
  assert.equal(tcToFrames('17:19', FPS), 0)
}

{
  // end − start, the fallback that was unreachable, agrees exactly.
  const start = tcToFrames('00:07:45:01', FPS)
  const end = tcToFrames('00:08:02:20', FPS)
  assert.equal(start, 11161)
  assert.equal(end, 11588)
  assert.equal(end - start, 427)
}

{
  // Every right-aligned width Avid can emit: FF, SS:FF, MM:SS:FF, HH:MM:SS:FF.
  assert.equal(durationToFrames('19', FPS), 19)
  assert.equal(durationToFrames('17:19', FPS), 427)
  // The IN-OUT sample recorded in HANDOFF.md.
  assert.equal(durationToFrames('17:03', FPS), 411)
  // One minute, and full width.
  assert.equal(durationToFrames('1:00:00', FPS), 1440)
  assert.equal(durationToFrames('01:00:00:00', FPS), 86400)
}

{
  // Drop-frame separator, and junk.
  assert.equal(durationToFrames('17;19', FPS), 427)
  assert.equal(durationToFrames('', FPS), 0)
  assert.equal(durationToFrames('n/a', FPS), 0)
  assert.equal(durationToFrames(null, FPS), 0)
}

{
  // tcToFrames must STAY strict: a position missing a field is a real bug and
  // reinterpreting it right-aligned would silently produce a wrong position.
  assert.equal(tcToFrames('01:02:03:04', FPS), 89356)
  assert.equal(tcToFrames('02:03:04', FPS), 0)
  assert.equal(tcToFrames('', FPS), 0)
  assert.equal(tcToFrames('a:b:c:d', FPS), 0)
  // Drop-frame separator parses as a position.
  assert.equal(tcToFrames('01:02:03;04', FPS), 89356)
}

console.log('timecode: all assertions passed')
