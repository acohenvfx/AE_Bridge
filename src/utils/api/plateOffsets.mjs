// Pure helper shared by the Avid-facing timeline code and regression tests.
// Split out of timeline.js so it can be unit-tested without importing
// grpc-web/MCAPI (timeline.js can't be loaded by plain Node — see
// tests/test_plate_offsets.mjs).

// AE layer alignment across a collected stack. Every track in a stack is
// grabbed at the SAME headFrame/atTC (grabShot's one shared anchor — see
// doGrab/doGrabTrackAcrossRange, which never vary it per track), so every
// plate's file contains that identical instant, just `head_handles` frames
// into its own file. Aligning that instant across plates needs only the
// handle counts: offset_frames = base.head_handles - p.head_handles.
//
// Previously this compared each plate's own `rec_in` (from a PER-TRACK EDL
// lookup) instead. That trusted cross-track EDL agreement that doesn't hold:
// on a real shot where Avid confirmed both clips sit at the identical
// timecode, V1's per-track EDL scan resolved to the *previous* cut (624
// frames off — the exact gap between the two EDL events) while V2/V3
// resolved correctly, producing a huge false offset despite all three plates
// being extracted from the same instant. `head_handles` never leaves a single
// grab's own pass, so it can't pick up that kind of cross-track disagreement.
// Plates are ordered bottom (lowest track) first.
export function plateOffsets(plates) {
  const sorted = (plates || []).slice().sort((a, b) => a.track - b.track)
  if (!sorted.length) return []
  const base = sorted[0]
  return sorted.map((p, i) => ({
    ...p,
    order: i + 1,
    offset_frames: (base.head_handles || 0) - (p.head_handles || 0),
  }))
}
