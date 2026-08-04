// Pure EDL helpers shared by the Avid-facing timeline code and regression tests.

export function preferredEdlSetting(names) {
  const clean = (names || []).map((name) => String(name || '').trim()).filter(Boolean)
  return clean.find((name) => /cmx\s*3600/i.test(name)) || clean[0] || ''
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
