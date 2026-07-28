// AEBridge timeline access — grab the shot under the record monitor.
//
// MCAPI (this SDK) does not expose timeline marks or per-segment selection
// directly, so "grab the clip" works like an editor would:
//   1. GetViewerMobs -> the record monitor's current sequence + playhead.
//   2. CreateSubClip(use_marks_bounds) -> turn the marked IN/OUT range into a
//      new sequence in a temp bin (the editor marks the shot).
//   3. Diff the temp bin (GetListOfBinItems) to recover the new mob id
//      (CreateSubClip returns no id).
//   4. GetMobInfo -> name / rate / res / start TC.
//   5. ExportFile -> reference movie.
//
// All calls run in the panel WebView (the mcapi global is injected there).
import {
  GetViewerMobsRequest,
  GetViewerMobsRequestBody,
  GetMobInfoRequest,
  GetMobInfoRequestBody,
  GetOpenProjectInfoRequest,
  GetOpenProjectInfoRequestBody,
  GetListOfBinItemsRequest,
  GetListOfBinItemsRequestBody,
  CreateBinRequest,
  CreateBinRequestBody,
  OpenBinRequest,
  OpenBinRequestBody,
  CreateSubClipRequest,
  CreateSubClipRequestBody,
  ExportFileRequest,
  ExportFileRequestBody,
  GetListOfExportSettingsRequest,
  GetListOfExportSettingsRequestBody,
  GetMarkersRequest,
  GetMarkersRequestBody,
  GetListOfCommandsRequest,
  GetListOfCommandsRequestBody,
  SetMobInfoRequest,
  SetMobInfoRequestBody,
  ColumnInfo,
  ImportFileRequest,
  ImportFileRequestBody,
  GetMobTrackInfoRequest,
  GetMobTrackInfoRequestBody,
  ExportEDLRequest,
  ExportEDLRequestBody,
  TrackLabel,
  TrackList,
  ViewerType,
} from '~/utils/grpc-web/MCAPI_Types_pb.js'

const TRACKTYPE_PICTURE = 0 // TrackType.TRACKTYPE_PICTURE (video)
import {
  getMcapiClient,
  getAccessTokenMetadata,
  callUnary,
  streamWithTimeout,
  logMcapiVerbose,
  logMcapiVerboseError,
} from '~/utils/api/mcapi'

const EXPORT_RPC_TIMEOUT_MS = 120000

export function mcapiAvailable() {
  return typeof mcapi !== 'undefined' && !!getMcapiClient()
}

function requireClient() {
  const client = getMcapiClient()
  if (!client) throw new Error('MCAPI is not available (run inside Media Composer)')
  return client
}

// --- viewers ---------------------------------------------------------------
export async function getViewerMobs() {
  const client = requireClient()
  const req = new GetViewerMobsRequest()
  req.setBody(new GetViewerMobsRequestBody())
  const res = await callUnary(client, 'getViewerMobs', req, getAccessTokenMetadata())
  const body = res && res.getBody ? res.getBody() : null
  const mobs = body && body.getMobsList ? body.getMobsList() : []
  return mobs.map((m) => ({
    mobId: m.getMobId(),
    viewType: m.getViewType(),
    currentFrame: m.getCurrentFrame(),
    currentTimecode: m.getCurrentTimecode(),
  }))
}

export async function getRecordSequence() {
  const mobs = await getViewerMobs()
  logMcapiVerbose('viewer mobs', mobs)
  const record = mobs.find((m) => m.viewType === ViewerType.RECORD)
  const chosen = record || mobs[0]
  if (!chosen || !chosen.mobId) {
    throw new Error('No sequence loaded in the Record monitor')
  }
  return chosen
}

// --- mob columns -----------------------------------------------------------
export function getMobColumns(mobId) {
  const client = requireClient()
  return new Promise((resolve, reject) => {
    const req = new GetMobInfoRequest()
    const body = new GetMobInfoRequestBody()
    body.setMobId(mobId)
    body.setOnlyVisibleColumns(false)
    body.setIncludesEmptyColumns(false)
    req.setBody(body)

    const cols = {}
    const stream = streamWithTimeout(
      client.getMobInfo(req, getAccessTokenMetadata()),
      30000
    )
    stream.on('data', (resp) => {
      const b = resp.getBody()
      if (b) cols[b.getColumnName()] = b.getColumnValue()
    })
    stream.on('error', (err) => {
      logMcapiVerboseError('getMobInfo', err)
      reject(err)
    })
    stream.on('end', () => {
      logMcapiVerbose('mob columns', cols)
      resolve(cols)
    })
  })
}

// --- project defaults ------------------------------------------------------
export async function getProjectInfo() {
  const client = requireClient()
  const req = new GetOpenProjectInfoRequest()
  req.setBody(new GetOpenProjectInfoRequestBody())
  const res = await callUnary(client, 'getOpenProjectInfo', req, getAccessTokenMetadata())
  const b = res && res.getBody ? res.getBody() : null
  if (!b) return {}
  const fr = b.getFrameRate ? b.getFrameRate() : null
  return {
    path: b.getPath ? b.getPath() : '',
    projectType: b.getProjectType ? b.getProjectType() : '',
    frameRate: fr && fr.getNum ? fr.getNum() / (fr.getDen() || 1) : null,
    dropFrame: b.getDropFrame ? Boolean(b.getDropFrame()) : false,
    width: b.getRasterWidth ? b.getRasterWidth() : null,
    height: b.getRasterHeight ? b.getRasterHeight() : null,
  }
}

// Best-effort parse of shot metadata from GetMobInfo columns + project info.
// Column names vary by install, so we look across likely candidates and keep
// the raw columns for debugging.
function pick(cols, names) {
  for (const n of names) {
    if (cols[n] != null && String(cols[n]).trim() !== '') return cols[n]
  }
  return ''
}

function parseResolution(cols, project) {
  const raw = pick(cols, ['Image Size', 'Frame', 'Format', 'Raster Dimensions'])
  const m = String(raw).match(/(\d{3,5})\s*[x×]\s*(\d{3,5})/)
  if (m) return { w: Number(m[1]), h: Number(m[2]) }
  if (project.width && project.height) return { w: project.width, h: project.height }
  return { w: 1920, h: 1080 }
}

function parseRate(cols, project) {
  const raw = pick(cols, ['FPS', 'Frame Rate', 'Edit Rate'])
  const n = parseFloat(String(raw).replace(/[^\d.]/g, ''))
  if (n) return String(n)
  if (project.frameRate) return String(Math.round(project.frameRate * 1000) / 1000)
  return '24'
}

export async function getCurrentShot() {
  const seq = await getRecordSequence()
  const [cols, project] = await Promise.all([getMobColumns(seq.mobId), getProjectInfo().catch(() => ({}))])
  const resolution = parseResolution(cols, project)
  const frameRate = parseRate(cols, project)
  return {
    mobId: seq.mobId,
    name: pick(cols, ['Name']) || 'sequence',
    startTC: pick(cols, ['Start']),
    playheadTC: seq.currentTimecode,
    playheadFrame: seq.currentFrame,
    frameRate,
    dropFrame: project.dropFrame || /;/.test(seq.currentTimecode || ''),
    resolution,
    columns: cols,
  }
}

// --- bin listing (to recover the subclip mob id) ---------------------------
function listBinItems(binPath, flags) {
  const client = requireClient()
  const F = GetListOfBinItemsRequestBody.BinItemFlags
  const useFlags = flags || (F ? [F.ALLTYPES] : null)
  return new Promise((resolve, reject) => {
    const req = new GetListOfBinItemsRequest()
    const body = new GetListOfBinItemsRequestBody()
    if (body.setBinRelativePath) body.setBinRelativePath(binPath)
    // Without type flags MC returns nothing.
    if (body.setBinFlagsList && useFlags) body.setBinFlagsList(useFlags)
    req.setBody(body)
    const items = []
    const stream = streamWithTimeout(
      client.getListOfBinItems(req, getAccessTokenMetadata()),
      30000
    )
    stream.on('data', (resp) => {
      const b = resp.getBody ? resp.getBody() : resp
      if (b && b.getMobId) items.push({ mobId: b.getMobId(), mobName: b.getMobName(), selected: b.getMobSelected() })
    })
    stream.on('error', reject)
    stream.on('end', () => resolve(items))
  })
}

// --- bin path resolution ---------------------------------------------------
// MC is picky about bin path spelling; try likely candidates and use whichever
// GetListOfBinItems actually resolves (that's the spelling CreateSubClip wants).
function binPathCandidates(binName, projectPath) {
  const base = String(binName).replace(/\.avb$/i, '')
  const cands = [base + '.avb', base]
  const p = String(projectPath || '').replace(/\\/g, '/')
  if (p) {
    const dir = p.replace(/\/[^/]*\.avp$/i, '') // strip a trailing ProjectName.avp
    cands.push(dir + '/' + base + '.avb')
  }
  return Array.from(new Set(cands))
}

async function resolveBinPath(binName) {
  const project = await getProjectInfo().catch(() => ({}))
  const cands = binPathCandidates(binName, project.path)
  for (const c of cands) {
    try {
      await listBinItems(c)
      logMcapiVerbose('bin path resolved', c)
      return c
    } catch (e) {
      logMcapiVerbose('bin path candidate failed', { c, err: e.message })
    }
  }
  return cands[0]
}

// --- ensure the destination bin exists + is open --------------------------
export async function ensureBin(binName) {
  const client = requireClient()
  const meta = getAccessTokenMetadata()
  const base = String(binName).replace(/\.avb$/i, '')
  // Try opening common spellings first.
  for (const p of [base + '.avb', base]) {
    try {
      const oreq = new OpenBinRequest()
      const obody = new OpenBinRequestBody()
      obody.setBinPath(p)
      oreq.setBody(obody)
      await callUnary(client, 'openBin', oreq, meta)
      logMcapiVerbose('openBin', p)
      return
    } catch (e) {
      logMcapiVerbose('openBin failed', { p, err: e.message })
    }
  }
  // Not open/existing — create it at the project root (also opens it).
  try {
    const creq = new CreateBinRequest()
    const cbody = new CreateBinRequestBody()
    cbody.setFolderPath('')
    cbody.setBinName(base)
    if (CreateBinRequestBody.OpenBinOption) {
      cbody.setOption(CreateBinRequestBody.OpenBinOption.FOLLOWBINSETTINGS)
    }
    creq.setBody(cbody)
    await callUnary(client, 'createBin', creq, meta)
    logMcapiVerbose('createBin', base)
  } catch (e) {
    // Likely "already exists" — fine, it exists and should be open now.
    logMcapiVerbose('createBin (ignored)', e.message)
  }
}

// --- source-clip grab ------------------------------------------------------
// Handles come from the SOURCE master clip's own media (never the sequence
// timeline): subclip the marked portion of the source clip, then extend THAT
// subclip by `handles`.
export async function getMobTrackInfo(mobId) {
  const client = requireClient()
  const req = new GetMobTrackInfoRequest()
  const body = new GetMobTrackInfoRequestBody()
  body.setMobId(mobId)
  req.setBody(body)
  const res = await callUnary(client, 'getMobTrackInfo', req, getAccessTokenMetadata())
  const b = res && res.getBody ? res.getBody() : null
  const list = b && b.getTrackInfoList ? b.getTrackInfoList() : null
  const infos = list && list.getTrackInfoList ? list.getTrackInfoList() : []
  return infos.map((ti) => {
    const label = ti.getLabel ? ti.getLabel() : null
    return {
      type: label && label.getType ? label.getType() : 0,
      number: label && label.getNumber ? label.getNumber() : 0,
      enabled: ti.getEnabled ? Boolean(ti.getEnabled()) : false,
      selected: ti.getSelected ? Boolean(ti.getSelected()) : false,
      monitored: ti.getMonitored ? Boolean(ti.getMonitored()) : false,
      numSegments: ti.getNumSegments ? ti.getNumSegments() : 0,
    }
  })
}

export function videoTracks(tracks) {
  return tracks
    .filter((t) => t.type === TRACKTYPE_PICTURE && (t.enabled || t.selected) && t.numSegments > 0)
    .sort((a, b) => a.number - b.number)
}

// Video tracks that are ENABLED — strictly, not "enabled or selected". This is
// the state `enabled_tracks_only` exports from, so it is what decides whether a
// track is soloed for a clean plate grab.
export function enabledVideoTracks(tracks) {
  return (tracks || [])
    .filter((t) => t.type === TRACKTYPE_PICTURE && t.enabled && t.numSegments > 0)
    .sort((a, b) => a.number - b.number)
}

// Run ExportEDL for one track; returns the EDL file path MC wrote.
export async function exportEdlForTrack(mobId, track) {
  const client = requireClient()
  const req = new ExportEDLRequest()
  const body = new ExportEDLRequestBody()
  body.setMobId(mobId)
  const tl = new TrackList()
  const lbl = new TrackLabel()
  lbl.setType(track.type)
  lbl.setNumber(track.number)
  tl.setTrackLabelsList([lbl])
  body.setTrackList(tl)
  req.setBody(body)
  const res = await callUnary(client, 'exportEDL', req, getAccessTokenMetadata(), 120000)
  const b = res && res.getBody ? res.getBody() : null
  const path = b && b.getPath ? String(b.getPath() || '').trim() : ''
  // Log the path per track: if MC reuses ONE path for every track, a read can
  // race/return the previous track's EDL — which would silently break any
  // per-track reasoning built on it.
  logMcapiVerbose('exportEDL path V' + track.number, path)
  return path
}

// From parsed EDL clips, find the one whose record span contains the playhead.
export function findClipAtPlayhead(clips, playheadTC, fps = 24) {
  const p = tcToFrames(playheadTC, fps)
  return (clips || []).find((c) => {
    const a = tcToFrames(c.rec_in, fps)
    const b = tcToFrames(c.rec_out, fps)
    return p >= a && p < b
  }) || null
}

// One CreateSubClip; returns the new SUBCLIP items (via SUBCLIPS-flag diff).
// Pass headTimecode/endTimecode (record TC) to target a specific clip span, or
// useMarks for the marked range.
async function createRawSubclip({ mobId, binPath, useMarks, useClipBounds, trackList, addFramesHead = 0, addFramesEnd = 0, headTimecode, endTimecode, headFrame, endFrame, enabledTracksOnly = false }) {
  const client = requireClient()
  const F = GetListOfBinItemsRequestBody.BinItemFlags
  const before = new Set(F ? (await listBinItems(binPath, [F.SUBCLIPS]).catch(() => [])).map((i) => i.mobId) : [])
  const req = new CreateSubClipRequest()
  const body = new CreateSubClipRequestBody()
  body.setDestinationBinPath(binPath)
  body.setMobId(mobId)
  body.setUseMarksBounds(!!useMarks)
  body.setUseClipBounds(!!useClipBounds)
  // Prefer frame offsets when given (the SubclipIt method); else fall back to
  // record timecodes; else -1/-1 (whole clip via useClipBounds).
  const useFrames = Number.isInteger(headFrame)
  body.setHeadFrame(useFrames ? headFrame : -1)
  body.setEndFrame(Number.isInteger(endFrame) ? endFrame : (useFrames ? headFrame + 1 : -1))
  if (!useFrames && headTimecode) body.setHeadTimecode(headTimecode)
  if (!useFrames && endTimecode) body.setEndTimecode(endTimecode)
  body.setCreateNewSequence(false)
  // enabled_tracks_only is the ONLY thing that actually isolates a track on
  // export — track_list is not honored by CreateSubClip (it fans/uses all
  // tracks). With this false, V2+ gets flattened into the export.
  body.setEnabledTracksOnly(!!enabledTracksOnly)
  body.setRetainMarkers(true)
  body.setAddFramesAtHead(Math.max(0, addFramesHead || 0))
  body.setAddFramesAtEnd(Math.max(0, addFramesEnd || 0))
  if (trackList && trackList.length) {
    const tl = new TrackList()
    tl.setTrackLabelsList(trackList.map((t) => {
      const l = new TrackLabel()
      l.setType(t.type)
      l.setNumber(t.number)
      return l
    }))
    body.setTrackList(tl)
  }
  req.setBody(body)
  await callUnary(client, 'createSubClip', req, getAccessTokenMetadata())
  const after = F ? await listBinItems(binPath, [F.SUBCLIPS]).catch(() => []) : []
  return after.filter((i) => !before.has(i.mobId))
}

const handlesUnavailable = (e) =>
  /requested frames not available|invalid add_frame/i.test(String((e && e.message) || e))

function durFrames(cols, fps) {
  const s = tcToFrames(pick(cols, ['Start', 'Mark IN']), fps)
  const e = tcToFrames(pick(cols, ['End', 'Mark OUT']), fps)
  return e - s
}

// Extend a subclip by handles, dropping ONLY the edge the error names (so we
// never guess a tail-only extension that could return the wrong range). A
// rejected CreateSubClip creates no mob, so only the success makes a clip.
async function extendWithHandles({ mobId, binPath, handles }) {
  const h = Math.max(0, Number(handles) || 0)
  let head = h
  let end = h
  for (let i = 0; i < 4; i += 1) {
    try {
      const items = await createRawSubclip({
        mobId, binPath, useMarks: false, useClipBounds: true, trackList: null,
        addFramesHead: head, addFramesEnd: end,
      })
      if (items.length) {
        logMcapiVerbose('handles applied', { requested: h, head, end })
        return { items, head, end }
      }
      return { items: [], head: 0, end: 0 }
    } catch (e) {
      if (!handlesUnavailable(e)) throw e
      const msg = String((e && e.message) || e).toLowerCase()
      if (/at_end/.test(msg) && end > 0) { end = 0 }
      else if (/at_head/.test(msg) && head > 0) { head = 0 }
      else if (head > 0 || end > 0) { head = 0; end = 0 }
      else throw e
      logMcapiVerbose('handle edge unavailable, reducing', { head, end, err: e.message })
    }
  }
  return { items: [], head: 0, end: 0 }
}

// Find the clip under the playhead on ONE video track, via that track's own EDL
// (ExportEDL honors track_list — confirmed). Avid can only isolate a track on
// export via enabled_tracks_only, so the track must be enabled.
// Returns { track, target, fps, allTracks }.
async function chooseTrackAndTarget({ sequenceMobId, playheadTC, parseEdl, trackNumber = 1 }) {
  const allTracks = await getMobTrackInfo(sequenceMobId)
  logMcapiVerbose('track info', allTracks)
  const label = 'V' + trackNumber
  const track = allTracks.find((t) => t.type === TRACKTYPE_PICTURE && t.number === trackNumber)
  if (!track) throw new Error('No ' + label + ' (video track ' + trackNumber + ') on this sequence')
  if (!track.numSegments) throw new Error(label + ' has no clips')
  if (!track.enabled) throw new Error('Enable ' + label + ' before grabbing (turn on the ' + label + ' track). Avid only exports ENABLED tracks.')
  logMcapiVerbose('chosen track', { chosen: track })
  const fps = 24

  const edlPath = await exportEdlForTrack(sequenceMobId, track)
  const clips = (edlPath && parseEdl) ? await parseEdl(edlPath) : []
  logMcapiVerbose(label + ' EDL clips', { count: clips.length, numSegments: track.numSegments, clips: clips.map((c) => ({ n: c.clip_name, in: c.rec_in, out: c.rec_out })) })
  const target = findClipAtPlayhead(clips, playheadTC, fps)
  if (!target) {
    throw new Error('No ' + label + ' clip under the playhead (' + playheadTC + '). Park on the shot first.')
  }
  logMcapiVerbose('playhead clip', { playheadTC, clip: target.clip_name, rec_in: target.rec_in, rec_out: target.rec_out, src_in: target.src_in, src_out: target.src_out })
  return { track, target, fps, allTracks }
}

// Enumerate the plate stack under the playhead: every video track carrying a
// clip there, bottom (V1) first. This is the grab PLAN — run it once while the
// tracks are in their normal (all-enabled) state, then grab each plate in its
// own pass. Per-track enumeration is reliable because ExportEDL honors
// track_list; per-track media export is not, which is why passes exist.
export async function analyzeStack({ parseEdl }) {
  const shot = await getCurrentShot()
  const allTracks = await getMobTrackInfo(shot.mobId)
  const fps = 24
  const vids = allTracks
    .filter((t) => t.type === TRACKTYPE_PICTURE && t.numSegments > 0)
    .sort((a, b) => a.number - b.number)
  const stack = []
  for (const t of vids) {
    try {
      const p = await exportEdlForTrack(shot.mobId, t)
      const clips = (p && parseEdl) ? await parseEdl(p) : []
      const c = findClipAtPlayhead(clips, shot.playheadTC, fps)
      logMcapiVerbose('stack scan V' + t.number, c
        ? { clip: c.clip_name, span: c.rec_in + ' → ' + c.rec_out, enabled: t.enabled }
        : { empty: true, enabled: t.enabled })
      if (c) {
        stack.push({
          track: t.number,
          enabled: t.enabled,
          clipName: c.clip_name,
          recIn: c.rec_in,
          recOut: c.rec_out,
        })
      }
    } catch (e) {
      logMcapiVerbose('stack scan V' + t.number + ' failed', e.message)
    }
  }
  logMcapiVerbose('stack at playhead', { playheadTC: shot.playheadTC, tracks: stack.map((s) => 'V' + s.track) })
  return { shot, stack }
}

async function grabSourceHandledMob({ sequenceMobId, playheadTC, playheadFrame, parseEdl, destBinPath, handles, trackNumber = 1, scratchBin = 'AEBridge_Scratch' }) {
  await ensureBin(destBinPath)
  const destPath = await resolveBinPath(destBinPath)
  await ensureBin(scratchBin)
  const scratchPath = await resolveBinPath(scratchBin)
  const { track, target, fps, allTracks } = await chooseTrackAndTarget({ sequenceMobId, playheadTC, parseEdl, trackNumber })
  const wantTrack = 'V' + track.number

  // ISOLATION GUARD. CreateSubClip does NOT fan one subclip per enabled track
  // (verified in Avid 2026-07-28): with V1+V2 enabled it returns ONE subclip of
  // the enabled COMPOSITE, labelled with the bottom track — its `Tracks` column
  // reads exactly "V1" while the media is V2 over V1. The columns lie, so track
  // classification cannot be trusted. The enable state is the only isolation
  // lever: exactly one video track may carry a clip under the playhead, or what
  // we export is a flatten. Check each other enabled video track's own EDL
  // (ExportEDL *does* honor track_list) for a clip at the playhead.
  const conflicts = []
  for (const t of allTracks) {
    if (t.type !== TRACKTYPE_PICTURE || t.number === track.number) continue
    if (!t.enabled || !t.numSegments) continue
    try {
      const p = await exportEdlForTrack(sequenceMobId, t)
      const cl = (p && parseEdl) ? await parseEdl(p) : []
      const c = findClipAtPlayhead(cl, playheadTC, fps)
      // numSegments tells us how many clips this track really has. If the EDL
      // came back with a wildly different count, ExportEDL did NOT isolate the
      // track (or we read a stale file) and this check cannot be trusted.
      logMcapiVerbose('isolation check V' + t.number, {
        edlClips: cl.length,
        numSegments: t.numSegments,
        countMatches: cl.length === t.numSegments,
        clipAtPlayhead: c ? c.clip_name : null,
        span: c ? c.rec_in + ' → ' + c.rec_out : null,
      })
      if (c) conflicts.push('V' + t.number)
    } catch (e) {
      // Can't prove it's empty there — treat as a conflict rather than risk a flatten.
      logMcapiVerbose('isolation check V' + t.number + ' FAILED (treating as conflict)', e.message)
      conflicts.push('V' + t.number)
    }
  }
  if (conflicts.length) {
    throw new Error(
      'Enable ONLY ' + wantTrack + ' to grab this plate — ' + conflicts.join(', ') +
      ' also has a clip under the playhead, and Avid would export ' + wantTrack +
      ' flattened with it. Disable ' + conflicts.join(', ') + ', then grab again ' +
      '(each track is grabbed in its own pass).'
    )
  }

  // Step 1 — subclip the clip under the playhead with useClipBounds +
  // head_frame and enabled_tracks_only=TRUE (track_list is NOT honored by
  // CreateSubClip; enabled_tracks_only is the only isolation lever). Past the
  // guard above, exactly one video track carries the shot, so this yields the
  // isolated plate. The loop below is kept because MC can still return more
  // than one subclip (e.g. one per source clip); a stack is built by grabbing
  // each track in its own pass, not from this call.
  const headFrame = Number.isInteger(playheadFrame) ? playheadFrame : tcToFrames(playheadTC, fps)
  logMcapiVerbose('grab step1 (isolated by enable state)', { headFrame, clip: target.clip_name })
  const aItems = await createRawSubclip({
    mobId: sequenceMobId, binPath: scratchPath, useMarks: false, useClipBounds: true,
    enabledTracksOnly: true, headFrame, endFrame: headFrame + 1,
  })
  if (!aItems.length) throw new Error('grab step 1 made no subclip for the playhead clip')

  // Past the guard exactly one video track is enabled over the shot, so every
  // subclip here is that track's. Still prefer an exactly-single-video-track
  // one: a multi-track `Tracks` value would mean the guard was evaded.
  const videoTokens = (cols) => String(pick(cols, ['Tracks']) || '').match(/V\d+/g) || []
  let a = null
  let aCols = null
  for (const item of aItems) {
    const cols = await getMobColumns(item.mobId).catch(() => ({}))
    logMcapiVerbose('step1 candidate', { name: item.mobName, tracks: pick(cols, ['Tracks']) })
    if (videoTokens(cols).length === 1) { a = item; aCols = cols; break }
  }
  if (!a) {
    throw new Error('No single-track subclip was produced for ' + wantTrack +
      '. Enable ONLY ' + wantTrack + ' over this shot and grab again.')
  }
  logMcapiVerbose('grab step1 (scratch subclip)', { mob: a, start: pick(aCols, ['Start']), end: pick(aCols, ['End']), dur: durFrames(aCols, fps), tracks: pick(aCols, ['Tracks']) })

  // Step 2 — extend by handles into the working bin, with the START+END
  // position sanity check; on mismatch fall back to the exact (no-handle)
  // scratch subclip, whose range is guaranteed correct.
  const { items: bItems, head, end } = await extendWithHandles({ mobId: a.mobId, binPath: destPath, handles })
  let exportMob = a
  let created = [a]
  let headH = 0
  let endH = 0
  if (bItems.length) {
    const bCols = await getMobColumns(bItems[0].mobId).catch(() => ({}))
    const aStart = tcToFrames(pick(aCols, ['Start']), fps)
    const aEnd = tcToFrames(pick(aCols, ['End']), fps)
    const bStart = tcToFrames(pick(bCols, ['Start']), fps)
    const bEnd = tcToFrames(pick(bCols, ['End']), fps)
    const startOk = Math.abs(bStart - (aStart - head)) <= 2
    const endOk = Math.abs(bEnd - (aEnd + end)) <= 2
    logMcapiVerbose('handled subclip position check', {
      aStart: pick(aCols, ['Start']), aEnd: pick(aCols, ['End']),
      bStart: pick(bCols, ['Start']), bEnd: pick(bCols, ['End']),
      head, end, startOk, endOk,
    })
    if (startOk && endOk) {
      exportMob = bItems[0]
      created = bItems
      headH = head
      endH = end
    } else {
      logMcapiVerbose('handled subclip wrong range — using exact (no handles)', {})
    }
  } else {
    throw new Error('source-handle step 2 produced no subclip in ' + destPath)
  }

  return { exportMob, created, headHandles: headH, endHandles: endH, target, track, fps }
}

// --- export settings + export ---------------------------------------------
export async function getExportSettings() {
  const client = requireClient()
  const req = new GetListOfExportSettingsRequest()
  req.setBody(new GetListOfExportSettingsRequestBody())
  const res = await callUnary(client, 'getListOfExportSettings', req, getAccessTokenMetadata())
  const b = res && res.getBody ? res.getBody() : null
  return b && b.getSettingNamesList ? b.getSettingNamesList() : []
}

function splitPath(outputPath) {
  const p = String(outputPath).replace(/\\/g, '/')
  const i = p.lastIndexOf('/')
  return { destinationPath: i < 0 ? '' : p.slice(0, i) || '/', fileName: i < 0 ? p : p.slice(i + 1) }
}

export async function exportMob({ mobId, outputPath, exportSettingsName = '' }) {
  const client = requireClient()
  const { destinationPath, fileName } = splitPath(outputPath)
  const req = new ExportFileRequest()
  const body = new ExportFileRequestBody()
  body.setMobId(mobId)
  body.setDestinationPath(destinationPath)
  body.setFileName(fileName)
  if (exportSettingsName) body.setExportSettingsName(exportSettingsName)
  req.setBody(body)
  const res = await callUnary(client, 'exportFile', req, getAccessTokenMetadata(), EXPORT_RPC_TIMEOUT_MS)
  const rb = res && res.getBody ? res.getBody() : null
  const path = rb && rb.getPath ? String(rb.getPath()).trim() : ''
  return path || outputPath
}

// --- markers ---------------------------------------------------------------
// Read markers on a mob. Pass `track` ({type, number}) to restrict to markers
// on that track only (used so a stacked shot takes V1's marker, not V2's).
// Returns [{name, comment, offset, trackType, trackNumber}].
export async function getMarkers(mobId, track) {
  const client = requireClient()
  const req = new GetMarkersRequest()
  const body = new GetMarkersRequestBody()
  body.setMobId(mobId)
  if (track && body.setTrack) {
    const lbl = new TrackLabel()
    lbl.setType(track.type)
    lbl.setNumber(track.number)
    body.setTrack(lbl)
  }
  req.setBody(body)
  const res = await callUnary(client, 'getMarkers', req, getAccessTokenMetadata())
  const b = res && res.getBody ? res.getBody() : null
  const infos = b && b.getInfoList ? b.getInfoList() : []
  const out = infos.map((i) => {
    const tl = i.getTrackLabel ? i.getTrackLabel() : null
    return {
      name: i.getName ? i.getName() : '',
      comment: i.getComment ? i.getComment() : '',
      offset: i.getOffset ? i.getOffset() : 0,
      trackType: tl && tl.getType ? tl.getType() : null,
      trackNumber: tl && tl.getNumber ? tl.getNumber() : null,
    }
  })
  logMcapiVerbose('markers', out)
  return out
}

// Best marker label = first non-empty comment (then name), earliest offset first.
export function markerLabel(markers) {
  const sorted = (markers || []).slice().sort((a, b) => (a.offset || 0) - (b.offset || 0))
  const c = sorted.find((m) => (m.comment || '').trim())
  if (c) return c.comment.trim()
  const n = sorted.find((m) => (m.name || '').trim())
  return n ? n.name.trim() : ''
}

// Rename a mob (SetMobInfo 'Name' column).
export async function renameMob(mobId, newName) {
  const client = requireClient()
  const req = new SetMobInfoRequest()
  const body = new SetMobInfoRequestBody()
  body.setMobId(mobId)
  const col = new ColumnInfo()
  col.setColumnName('Name')
  col.setColumnValue(newName)
  body.setColumn(col)
  req.setBody(body)
  await callUnary(client, 'setMobInfo', req, getAccessTokenMetadata())
}

// --- return import ---------------------------------------------------------
// Import the AE render back into Avid, into a returns bin. Returns the new mobId.
export async function importReturn({ filePath, destBinPath, importSettingsName = '' }) {
  const client = requireClient()
  await ensureBin(destBinPath)
  const binPath = await resolveBinPath(destBinPath)
  const req = new ImportFileRequest()
  const body = new ImportFileRequestBody()
  body.setFilePath(filePath)
  if (importSettingsName) body.setImportSettingsName(importSettingsName)
  if (body.setDestinationBin) body.setDestinationBin(binPath)
  req.setBody(body)
  const res = await callUnary(client, 'importFile', req, getAccessTokenMetadata(), 120000)
  const rb = res && res.getBody ? res.getBody() : null
  return rb && rb.getMobId ? String(rb.getMobId() || '') : ''
}

// --- orchestrator ----------------------------------------------------------
// Grab ONE plate — the clip under the playhead on `trackNumber` — as a subclip
// with source handles, renamed. Returns { shot, exportMobId, plate } WITHOUT
// exporting, so the caller can name the export after the shot first.
//
// A stacked shot is grabbed one track per call (only the enable state isolates
// a track), each call requiring that track to be the only enabled video track
// over the shot. `baseName` carries V1's marker name to the upper passes so
// every plate in a stack shares one base.
export async function grabShot({ destBinPath, handles = 0, parseEdl = null, trackNumber = 1, baseName = '' }) {
  const shot = await getCurrentShot()
  // Grab the clip under the playhead from its SOURCE master (handles from the
  // source's own media, never the sequence timeline).
  const r = await grabSourceHandledMob({ sequenceMobId: shot.mobId, playheadTC: shot.playheadTC, playheadFrame: shot.playheadFrame, parseEdl, destBinPath, handles, trackNumber })
  const sequence = r.exportMob
  const created = r.created

  // Read the marker for THIS pass's clip on THIS track. Markers live on the
  // SEQUENCE (a master-clip subclip does not carry them), so read the
  // sequence's, restricted to the grabbed track and this clip's record span.
  // Every pass does this — each track in a stack can carry its own marker.
  let marker = ''
  try {
    const t = r.target
    if (t) {
      const seqStartF = tcToFrames(shot.startTC || '00:00:00:00', 24)
      const inF = tcToFrames(t.rec_in, 24) - seqStartF
      const outF = tcToFrames(t.rec_out, 24) - seqStartF
      // Restrict to markers on the grabbed track — server-side filter plus a
      // client-side guard in case the server ignores it — so each plate in a
      // stack takes its OWN track's comment, not a neighbour's.
      const wantT = r.track ? r.track.type : null
      const wantN = r.track ? r.track.number : null
      const all = await getMarkers(shot.mobId, r.track || undefined)
      const within = all.filter((m) => {
        const inSpan = (m.offset || 0) >= inF - 2 && (m.offset || 0) < outF + 2
        const onTrack = wantN == null || m.trackNumber == null || (m.trackType === wantT && m.trackNumber === wantN)
        return inSpan && onTrack
      })
      // Multiple markers can sit in one clip's span — prefer the one nearest the
      // playhead (that's the shot the editor parked on), not the earliest.
      const phF = Number.isInteger(shot.playheadFrame) ? shot.playheadFrame : null
      const chosen = (phF != null && within.length > 1)
        ? [within.slice().sort((a, b) => Math.abs((a.offset || 0) - phF) - Math.abs((b.offset || 0) - phF))[0]]
        : within
      marker = markerLabel(chosen)
      logMcapiVerbose('marker for V' + trackNumber, { inF, outF, playheadFrame: phF, count: within.length, marker })
    }
    // Fall back to any marker the subclip itself retained.
    if (!marker) marker = markerLabel(await getMarkers(sequence.mobId).catch(() => []))
  } catch (e) {
    logMcapiVerbose('marker read failed', e.message)
  }

  // Naming. The first pass (V1) names the whole stack from its marker. An upper
  // track prefers its OWN marker; `_plNN` is only the fallback for a track that
  // has no marker of its own.
  const name = baseName || marker || sequence.mobName || shot.name
  const plateName = trackNumber === 1
    ? name
    : (marker || name + '_pl' + String(trackNumber).padStart(2, '0'))
  logMcapiVerbose('plate name', { track: 'V' + trackNumber, marker: marker || null, base: name, plateName, fromMarker: !!(trackNumber !== 1 && marker) })
  for (const item of created) {
    await renameMob(item.mobId, plateName).catch((e) => logMcapiVerbose('rename failed', { id: item.mobId, err: e.message }))
  }
  logMcapiVerbose('grabbed plate', { track: 'V' + trackNumber, name: plateName, recIn: r.target && r.target.rec_in, head: r.headHandles, end: r.endHandles })

  const subCols = await getMobColumns(sequence.mobId).catch(() => ({}))
  const startTC = pick(subCols, ['Start', 'Mark IN'])
  const endTC = pick(subCols, ['End', 'Mark OUT'])
  const fps = Math.round(parseFloat(shot.frameRate) || 24)
  let frameCount = Number(pick(subCols, ['Duration Frames'])) || 0
  if (!frameCount) {
    const durTC = pick(subCols, ['Duration'])
    frameCount = durTC ? tcToFrames(durTC, fps) : (tcToFrames(endTC, fps) - tcToFrames(startTC, fps))
  }
  if (!frameCount || frameCount < 0) frameCount = 0

  return {
    exportMobId: sequence.mobId,
    createdMobIds: created.map((i) => i.mobId),
    // This pass's plate. The caller collects one per track, then computes AE
    // layer offsets across the collected set (see plateOffsets).
    plate: {
      track: trackNumber,
      mobId: sequence.mobId,
      name: plateName,
      rec_in: (r.target && r.target.rec_in) || '',
      rec_out: (r.target && r.target.rec_out) || '',
      head_handles: r.headHandles,
      end_handles: r.endHandles,
    },
    shot: {
      shot_name: name,
      sequence_name: shot.name,
      record_tc_in: startTC || shot.playheadTC,
      record_tc_out: endTC || '',
      source_tc_in: startTC || '',
      frame_rate: shot.frameRate,
      drop_frame: shot.dropFrame,
      resolution: shot.resolution,
      frame_count: frameCount,
    },
  }
}

// AE layer alignment across a collected stack. Comp time 0 = the start of the
// BASE plate's file (its rec_in minus its head handles); every other plate's
// file starts at its own rec_in minus its own head handles, so the layer offset
// is the difference. Plates are ordered bottom (lowest track) first.
// Pure function — unit-testable without Avid.
export function plateOffsets(plates, fps = 24) {
  const sorted = (plates || []).slice().sort((a, b) => a.track - b.track)
  if (!sorted.length) return []
  const base = sorted[0]
  const baseStart = tcToFrames(base.rec_in || '', fps) - (base.head_handles || 0)
  return sorted.map((p, i) => ({
    ...p,
    order: i + 1,
    offset_frames: p.rec_in
      ? (tcToFrames(p.rec_in, fps) - (p.head_handles || 0)) - baseStart
      : 0,
  }))
}

// --- command probe ---------------------------------------------------------
// Enumerate the Avid commands this panel is allowed to drive.
//
// This previously failed with code=7 (access denied) and was written off as
// "DoCommand is denied for panels". But the RPC carries its own API scope,
// `avid.mediacomposer.command`, which the manifest did not declare. With the
// scope added, this call decides it: a list means the panel can drive Avid
// commands (and we look for track-selector ones to automate the stack grab);
// another code=7 means it really is off-limits.
//
// NOTE the generated getter is `getCommandid`, not `getCommandId`.
export async function probeCommands() {
  const client = requireClient()
  const req = new GetListOfCommandsRequest()
  req.setBody(new GetListOfCommandsRequestBody())
  const res = await callUnary(client, 'getListOfCommands', req, getAccessTokenMetadata())
  const b = res && res.getBody ? res.getBody() : null
  const list = b && b.getCommandsList ? b.getCommandsList() : []
  const cmds = list.map((c) => ({
    name: c.getName ? c.getName() : '',
    id: c.getCommandid ? c.getCommandid() : null,
    category: c.getCategory ? c.getCategory() : '',
  }))
  // Surface anything that looks like it could toggle a track, since that is
  // the whole reason for the probe.
  const trackish = cmds.filter((c) =>
    /track|video|select|enable|solo|v\d/i.test(c.name + ' ' + c.category))
  logMcapiVerbose('commands: total', cmds.length)
  logMcapiVerbose('commands: categories', Array.from(new Set(cmds.map((c) => c.category))).join(', '))
  logMcapiVerbose('commands: track-related', trackish)
  return { commands: cmds, trackRelated: trackish }
}

// Export the grabbed shot to `exportDir`, named after the shot. Returns the path.
export async function exportShot({ mobId, exportDir, fileName, exportSettingsName }) {
  const safeBase = String(fileName || 'ref').replace(/[/\\:*?"<>|]+/g, '_').trim() || 'ref'
  const outputPath = exportDir.replace(/\/$/, '') + '/' + safeBase
  return exportMob({ mobId, outputPath, exportSettingsName })
}

// HH:MM:SS:FF -> total frames (non-drop; TC labels at round(fps)).
function tcToFrames(tc, fps) {
  const p = String(tc || '').split(/[:;]/).map((n) => parseInt(n, 10))
  if (p.length < 4 || p.some(isNaN)) return 0
  const [hh, mm, ss, ff] = p
  return ((hh * 60 + mm) * 60 + ss) * fps + ff
}
