import assert from 'node:assert/strict'

import { plateOffsets } from '../src/utils/api/plateOffsets.mjs'

// Real regression case (2026-08-04): V1's per-track EDL scan resolved to the
// PREVIOUS clip (rec_in 01:02:37:01) while V2/V3 correctly resolved to the
// marked shot (rec_in 01:03:03:01) — Avid confirmed all three clips sit at
// the identical timecode. The old rec_in-difference formula turned that
//624-frame EDL disagreement into a false AE layer offset. Since every track
// in one stack is always grabbed at the same headFrame, alignment must come
// from head_handles alone — which stays correct here regardless of the
// rec_in mismatch.
{
  const plates = [
    { track: 1, rec_in: '01:02:37:01', head_handles: 8 },
    { track: 2, rec_in: '01:03:03:01', head_handles: 8 },
    { track: 3, rec_in: '01:03:03:01', head_handles: 8 },
  ]
  const out = plateOffsets(plates)
  assert.deepEqual(out.map((p) => p.offset_frames), [0, 0, 0])
}

// Asymmetric handles (the handle ladder fell back for one plate but not
// another) still align correctly: the plate with fewer head handles needs a
// LATER layer start to keep the shared instant lined up.
{
  const plates = [
    { track: 1, head_handles: 8 },
    { track: 2, head_handles: 3 },
  ]
  const out = plateOffsets(plates)
  assert.deepEqual(out.map((p) => p.offset_frames), [0, 5])
}

// Out-of-order input is sorted bottom (lowest track) first, and `order` is
// assigned accordingly regardless of input order.
{
  const plates = [
    { track: 3, head_handles: 0 },
    { track: 1, head_handles: 8 },
    { track: 2, head_handles: 8 },
  ]
  const out = plateOffsets(plates)
  assert.deepEqual(out.map((p) => p.track), [1, 2, 3])
  assert.deepEqual(out.map((p) => p.order), [1, 2, 3])
  assert.deepEqual(out.map((p) => p.offset_frames), [0, 0, 8])
}

// Single plate (no stack) — no offset, no crash.
assert.deepEqual(plateOffsets([{ track: 1, head_handles: 8 }]), [
  { track: 1, head_handles: 8, order: 1, offset_frames: 0 },
])

// Empty input.
assert.deepEqual(plateOffsets([]), [])
assert.deepEqual(plateOffsets(null), [])

console.log('PLATE OFFSET TESTS PASSED')
