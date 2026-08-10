// Narrow which video tracks Analyze considers, using Avid's own track
// SELECTION (the track-head highlight) rather than every track with content.
//
// Pure module (no `~` alias, no mcapi) so plain Node can test it — same
// reason plateOffsets.mjs and edlPlan.mjs live outside timeline.js.
//
// `selected` is a DIFFERENT signal from `enabled`. `enabled` is the
// export-isolation toggle `enabled_tracks_only` reads from (see the
// `CreateSubClip` facts in HANDOFF.md) — soloing it is still the only way to
// get an isolated plate out of one grab, and this module changes nothing
// about that. `selected` is just which track headers are highlighted, read
// alongside `enabled` in getMobTrackInfo already. Using it to narrow the
// ANALYZE scope (which tracks the tool looks at) rather than the GRAB
// mechanics (which track a given export isolates) means a 20-video-track
// sequence where the editor only cares about V14-16 can point the tool at
// exactly those three by clicking their track heads before Analyze, instead
// of scanning all 20 (which, on top of being slower, burns one EDL filename
// per track — see the "Avid EDL Exports filename counter" fact).

// `tracks` must already be narrowed to "has content" — this never widens the
// set, only narrows it further when a subset is selected.
export function narrowToSelection(tracks) {
  const all = tracks || []
  const selected = all.filter((t) => t.selected)
  return selected.length ? selected : all
}

// The track that names the whole stack: the lowest-numbered track in the
// (possibly narrowed) set. Ordinarily V1, but selecting V14-16 with nothing
// lower makes V14 the anchor — see grabShot's `anchorTrack` param.
export function lowestTrack(tracks) {
  const all = tracks || []
  if (!all.length) return null
  return all.reduce((min, t) => (t.number < min.number ? t : min), all[0])
}
