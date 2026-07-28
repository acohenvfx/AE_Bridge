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
  return b && b.getPath ? String(b.getPath() || '').trim() : ''
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

// ALWAYS grab from V1 (picture track number 1) and find the clip under the
// playhead via V1's EDL. Avid can only isolate a track on export via
// enabled_tracks_only, so V1 must be enabled. Returns { track, target, fps }.
async function chooseV1AndTarget({ sequenceMobId, playheadTC, parseEdl }) {
  const allTracks = await getMobTrackInfo(sequenceMobId)
  logMcapiVerbose('track info', allTracks)
  const track = allTracks.find((t) => t.type === TRACKTYPE_PICTURE && t.number === 1)
  if (!track) throw new Error('No V1 (video track 1) on this sequence')
  if (!track.numSegments) throw new Error('V1 has no clips')
  if (!track.enabled) throw new Error('Enable V1 before Send (turn on the V1 track). Avid only exports ENABLED tracks.')
  logMcapiVerbose('chosen V1 track (hardwired to V1)', { chosen: track })
  const fps = 24

  const edlPath = await exportEdlForTrack(sequenceMobId, track)
  const clips = (edlPath && parseEdl) ? await parseEdl(edlPath) : []
  logMcapiVerbose('V1 EDL clips', { count: clips.length, clips: clips.map((c) => ({ n: c.clip_name, in: c.rec_in, out: c.rec_out })) })
  const target = findClipAtPlayhead(clips, playheadTC, fps)
  if (!target) {
    throw new Error('No V1 clip under the playhead (' + playheadTC + '). Park on the shot before Send.')
  }
  logMcapiVerbose('playhead clip', { playheadTC, clip: target.clip_name, rec_in: target.rec_in, rec_out: target.rec_out, src_in: target.src_in, src_out: target.src_out })
  return { track, target, fps }
}

async function grabSourceHandledMob({ sequenceMobId, playheadTC, playheadFrame, parseEdl, destBinPath, handles, scratchBin = 'AEBridge_Scratch' }) {
  await ensureBin(destBinPath)
  const destPath = await resolveBinPath(destBinPath)
  await ensureBin(scratchBin)
  const scratchPath = await resolveBinPath(scratchBin)
  const { track, target, fps } = await chooseV1AndTarget({ sequenceMobId, playheadTC, parseEdl })
  const wantTrack = 'V' + track.number

  // Step 1 — isolate the target track's clip under the playhead the way EB's
  // SubclipIt does: CreateSubClip with useClipBounds + head_frame (the playhead
  // frame) and enabled_tracks_only=TRUE. track_list is NOT honored by
  // CreateSubClip, so enabled_tracks_only is the only thing that keeps other
  // tracks out of the export. MC fans one subclip per enabled track; we keep the
  // one that is EXACTLY the target track (single video track — no composite).
  const headFrame = Number.isInteger(playheadFrame) ? playheadFrame : tcToFrames(playheadTC, fps)
  logMcapiVerbose('grab step1 (' + wantTrack + '-only, enabledTracksOnly)', { headFrame, clip: target.clip_name })
  const aItems = await createRawSubclip({
    mobId: sequenceMobId, binPath: scratchPath, useMarks: false, useClipBounds: true,
    enabledTracksOnly: true, headFrame, endFrame: headFrame + 1,
  })
  if (!aItems.length) throw new Error('grab step 1 made no subclip for the playhead clip')

  // Keep the subclip that is EXACTLY the target track (single video track). A
  // subclip whose Tracks spans the target + another video track is a flattened
  // composite (a lower enabled track merged in) — surface that instead of
  // silently exporting a flatten.
  const videoTokens = (cols) => String(pick(cols, ['Tracks']) || '').match(/V\d+/g) || []
  const isExactlyTarget = (cols) => { const v = videoTokens(cols); return v.length === 1 && v[0] === wantTrack }
  let a = null
  let aCols = null
  let sawTargetComposite = false
  for (const item of aItems) {
    const cols = await getMobColumns(item.mobId).catch(() => ({}))
    const toks = videoTokens(cols)
    logMcapiVerbose('step1 candidate', { name: item.mobName, tracks: pick(cols, ['Tracks']) })
    if (isExactlyTarget(cols)) { a = item; aCols = cols; break }
    if (toks.includes(wantTrack)) sawTargetComposite = true
  }
  if (!a) {
    if (sawTargetComposite) {
      throw new Error(wantTrack + ' came back flattened with another video track. Disable the other enabled video track(s) so only ' + wantTrack + ' (the plate) is on, then Send again.')
    }
    throw new Error('No ' + wantTrack + '-only subclip was produced. Make sure the plate is the clip under the playhead and its track is enabled.')
  }
  const aDur = durFrames(aCols, fps)
  logMcapiVerbose('source-handle step1 (scratch subclip of source)', { mob: a, start: pick(aCols, ['Start']), end: pick(aCols, ['End']), dur: aDur, tracks: pick(aCols, ['Tracks']) })

  // Step 2: extend it by handles into the working bin.
  const { items: bItems, head, end } = await extendWithHandles({ mobId: a.mobId, binPath: destPath, handles })

  // Sanity-check the START + END positions, not just duration: the handled
  // subclip must be [aStart - head, aEnd + end]. If the position is off (some
  // clips extend to the wrong part of the source), discard it and export the
  // exact marked-range subclip (step 1) directly — guaranteed-correct range.
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
    if (!(startOk && endOk)) {
      logMcapiVerbose('handled subclip wrong range — exporting exact marked range (no handles)', {})
      return { exportMob: a, created: aItems, headHandles: 0, endHandles: 0, target, track }
    }
  }

  if (!bItems.length) throw new Error('source-handle step 2 produced no subclip in ' + destPath)
  logMcapiVerbose('source-handle step2 (in working bin)', { mob: bItems[0], head, end })
  return { exportMob: bItems[0], created: bItems, headHandles: head, endHandles: end, target, track }
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
// Grab the marked shot (subclip + rename), return { shot, exportMobId } WITHOUT
// exporting — so the caller can name the export folder after the shot first.
export async function grabShot({ destBinPath, handles = 0, parseEdl = null }) {
  const shot = await getCurrentShot()
  // Grab the V1 clip under the playhead from its SOURCE master (handles from the
  // source's own media, never the sequence timeline).
  const r = await grabSourceHandledMob({ sequenceMobId: shot.mobId, playheadTC: shot.playheadTC, playheadFrame: shot.playheadFrame, parseEdl, destBinPath, handles })
  const sequence = r.exportMob
  const created = r.created

  // Prefer the timeline marker comment as the shot name. The marker lives on the
  // SEQUENCE (a master-clip subclip does not carry it), so read the sequence
  // markers and keep the one inside this shot's record span; fall back to any
  // marker the exported subclip happens to retain.
  let name = sequence.mobName || shot.name
  try {
    let label = ''
    const t = r.target
    if (t) {
      const seqStartF = tcToFrames(shot.startTC || '00:00:00:00', 24)
      const inF = tcToFrames(t.rec_in, 24) - seqStartF
      const outF = tcToFrames(t.rec_out, 24) - seqStartF
      // Restrict to markers on the grabbed track (V1) — server-side filter, plus
      // a client-side guard in case the server ignores it — so a clip stacked
      // under V2+ still takes V1's marker comment, not the higher track's.
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
      label = markerLabel(chosen)
      logMcapiVerbose('marker in shot span', { inF, outF, playheadFrame: phF, track: wantN != null ? 'V' + wantN : null, count: within.length, label })
    }
    if (!label) label = markerLabel(await getMarkers(sequence.mobId).catch(() => []))
    if (label) {
      for (const item of created) {
        await renameMob(item.mobId, label).catch((e) => logMcapiVerbose('rename failed', { id: item.mobId, err: e.message }))
      }
      name = label
    }
  } catch (e) {
    logMcapiVerbose('marker read failed', e.message)
  }

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
