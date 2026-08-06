// Pure EDL helpers shared by the Avid-facing timeline code and regression tests.

export function preferredEdlSetting(names) {
  const clean = (names || []).map((name) => String(name || '').trim()).filter(Boolean)
  return clean.find((name) => name.toLowerCase() === 'vfx toolkit edl') || ''
}

export function normalizedVideoTrack(value) {
  const label = String(value || '').toUpperCase().replace(/\s+/g, '')
  if (label === 'V') return 1
  const match = label.match(/^V(\d+)$/)
  return match ? Number(match[1]) : null
}

export function clipsForTrack(clips, track) {
  const number = Number(track && track.number != null ? track.number : track)
  return (clips || []).filter((clip) => normalizedVideoTrack(clip.track) === number)
}

export function hasNumberedUpperTracks(clips) {
  return (clips || []).some((clip) => {
    const number = normalizedVideoTrack(clip.track)
    return number != null && number > 1
  })
}

// Which clip on one track belongs to a shot segment spanning [segStart, segEnd)?
// Frames in, not timecodes, so this stays pure and testable.
//
// This used to be point containment at the segment's FIRST frame, which
// quietly dropped any upper-track plate that starts partway into the shot —
// the normal shape of a stack, where V2/V3 sit over the middle of a longer V1
// clip. Reported live as "analyzing a range containing a stack only
// recognizes V1 and V2". OVERLAP is the right test: a plate belongs to the
// shot if it has picture anywhere inside it.
//
// A clip covering the segment's start still wins when one exists, so the
// single-clip-per-track case resolves exactly as it did before.
export function pickClipForSegment(clips, segStart, segEnd) {
  const overlapping = (clips || []).filter((c) => c.in < segEnd && c.out > segStart)
  if (!overlapping.length) return null
  return overlapping.find((c) => c.in <= segStart && segStart < c.out) || overlapping[0]
}

const PLATE_SUFFIX_RE = /_pl\d+$/i

// Every plate's name should carry its position in the stack (V1 = _pl01,
// V2 = _pl02, ...) so the files read as parts of one set even when a marker
// is just the bare shot name (e.g. vfx_010_0010). A name that already ends
// in _plNN — some pipelines pre-name their plates that way, and it showed up
// as V1's own marker in a real sequence during this project's testing — is
// left alone rather than doubled up into _pl01_pl01.
export function withPlateSuffix(name, trackNumber) {
  const base = String(name || '')
  if (PLATE_SUFFIX_RE.test(base)) return base
  return base + '_pl' + String(trackNumber).padStart(2, '0')
}

// Upper-track fallback name: the STEM of the base plus this track's own
// suffix. The base is V1's name and routinely already ends in _pl01 — the
// user's own marker convention writes it into the comment — and appending
// produced `<shot>_pl01_pl02` on V2 (reported live 2026-08-06). A plate
// carries exactly one _plNN: its own.
export function plateNameForTrack(base, trackNumber) {
  const stem = String(base || '').replace(PLATE_SUFFIX_RE, '')
  return stem + '_pl' + String(trackNumber).padStart(2, '0')
}

