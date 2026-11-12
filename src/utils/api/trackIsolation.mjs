// Which video tracks must be OFF for a single-track grab to be isolated.
//
// CreateSubClip with enabled_tracks_only exports the enabled COMPOSITE, so any
// other enabled picture track that carries clips can be flattened into the
// plate (use_clip_bounds spans the whole clip, not just the playhead frame, so
// a clip on that track anywhere nearby still counts). The grab's guard, the
// auto-grab watchers, and Grab All's auto-solo must all agree on this one rule,
// or Grab All solos the stack while the guard rejects a non-stack track, and
// auto-grab retries a grab that can never pass on every poll.
//
// Pure (no MCAPI) so it can be unit-tested.

export const TRACKTYPE_PICTURE = 0

const isPicture = (t) => t && t.type === TRACKTYPE_PICTURE

// Enabled picture tracks, other than `trackNumber`, that have any clips.
export function isolationConflicts(tracks, trackNumber) {
  return (tracks || [])
    .filter((t) => isPicture(t) && t.number !== trackNumber && t.enabled && t.numSegments > 0)
    .map((t) => t.number)
    .sort((a, b) => a - b)
}

// Tracks Grab All must manage (solo, then restore): every stack track plus
// every picture track that has clips — the ones the guard would object to.
export function soloScope(tracks, stackTracks) {
  const out = new Set(stackTracks || [])
  for (const t of tracks || []) {
    if (isPicture(t) && t.numSegments > 0) out.add(t.number)
  }
  return [...out].sort((a, b) => a - b)
}

// Status text when `solo` is otherwise ready but other tracks still conflict.
export function conflictMessage(solo, conflicts) {
  const list = conflicts.map((n) => 'V' + n).join(', ')
  return 'Waiting — V' + solo + ' is soloed, but ' + list +
    (conflicts.length === 1 ? ' is' : ' are') +
    ' also enabled and ' + (conflicts.length === 1 ? 'has' : 'have') +
    ' clips in this sequence; disable ' + (conflicts.length === 1 ? 'it' : 'them') +
    ' too so Avid doesn\'t flatten ' + (conflicts.length === 1 ? 'it' : 'them') + ' into the plate.'
}
