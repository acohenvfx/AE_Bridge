// Timecode and duration parsing.
//
// A pure module (no `~` webpack alias, no mcapi) so plain Node can import it —
// same reason plateOffsets.mjs and edlPlan.mjs live outside timeline.js.
//
// THE DISTINCTION THAT MATTERS: a POSITION and a DURATION are not the same
// shape in Avid's columns, and treating them as one is what produced
// `frame_count: 0` on every plate ever grabbed (see durationToFrames).

// An absolute position: `HH:MM:SS:FF` (`;` for drop-frame).
//
// Deliberately STRICT — anything without all four fields returns 0. A position
// that lost a field is a real bug (the two-frame-spaces trap in HANDOFF.md
// costs hours), so it must not be quietly reinterpreted.
export function tcToFrames(tc, fps) {
  const p = String(tc || '')
    .split(/[:;]/)
    .map((n) => parseInt(n, 10))
  if (p.length < 4 || p.some(isNaN)) return 0
  const [hh, mm, ss, ff] = p
  return ((hh * 60 + mm) * 60 + ss) * fps + ff
}

// A DURATION, which Avid writes RIGHT-ALIGNED with leading fields omitted:
// `FF`, `SS:FF`, `MM:SS:FF` or full `HH:MM:SS:FF`. The `Duration` column of a
// 427-frame plate at 24fps reads `17:19` — 17 seconds and 19 frames — and the
// `IN-OUT` column in HANDOFF.md shows the same shape (`17:03`).
//
// Why this is not just tcToFrames being lenient: passing `17:19` to
// tcToFrames returns 0, because two fields is fewer than four. The old
// frame_count chain read
//
//     frameCount = durTC ? tcToFrames(durTC, fps) : (end - start)
//
// so a present-but-short Duration SHADOWED the end−start fallback that would
// have worked, and every plate got 0. Not "occasionally": all 19 sidecars on
// the dev machine, 100%. Parsing right-aligned fixes the value; keeping it
// separate from tcToFrames keeps positions strict.
export function durationToFrames(tc, fps) {
  const p = String(tc || '')
    .split(/[:;]/)
    .map((n) => parseInt(n, 10))
  if (!p.length || p.some(isNaN)) return 0
  const [ff = 0, ss = 0, mm = 0, hh = 0] = p.reverse()
  return ((hh * 60 + mm) * 60 + ss) * fps + ff
}
