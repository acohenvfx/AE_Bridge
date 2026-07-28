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
async function createRawSubclip({ mobId, binPath, useMarks, useClipBounds, trackList, addFramesHead = 0, addFramesEnd = 0, headTimecode, endTimecode }) {
  const client = requireClient()
  const F = GetListOfBinItemsRequestBody.BinItemFlags
  const before = new Set(F ? (await listBinItems(binPath, [F.SUBCLIPS]).catch(() => [])).map((i) => i.mobId) : [])
  const req = new CreateSubClipRequest()
  const body = new CreateSubClipRequestBody()
  body.setDestinationBinPath(binPath)
  body.setMobId(mobId)
  body.setUseMarksBounds(!!useMarks)
  body.setUseClipBounds(!!useClipBounds)
  body.setHeadFrame(-1)
  body.setEndFrame(-1)
  if (headTimecode) body.setHeadTimecode(headTimecode)
  if (endTimecode) body.setEndTimecode(endTimecode)
  body.setCreateNewSequence(false)
  body.setEnabledTracksOnly(false)
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

async function grabSourceHandledMob({ sequenceMobId, playheadTC, parseEdl, destBinPath, handles, scratchBin = 'AEBridge_Scratch' }) {
  await ensureBin(destBinPath)
  const destPath = await resolveBinPath(destBinPath)
  await ensureBin(scratchBin)
  const scratchPath = await resolveBinPath(scratchBin)
  const vids = videoTracks(await getMobTrackInfo(sequenceMobId))
  if (!vids.length) throw new Error('No enabled video track for source-handle grab')
  const v1 = vids[0]
  const fps = 24

  // Find the V1 clip under the playhead (via the V1 EDL) — this is THE shot,
  // regardless of how wide the marked range is.
  const edlPath = await exportEdlForTrack(sequenceMobId, v1)
  const clips = (edlPath && parseEdl) ? await parseEdl(edlPath) : []
  const target = findClipAtPlayhead(clips, playheadTC, fps)
  if (!target) {
    throw new Error('No V1 clip under the playhead (' + playheadTC + '). Park on the shot before Send.')
  }
  logMcapiVerbose('playhead clip', { playheadTC, clip: target.clip_name, rec_in: target.rec_in, rec_out: target.rec_out })

  // Step 1: subclip exactly that clip's record span → source-master subclip in
  // scratch (head_timecode/end_timecode instead of the marks).
  const aItems = await createRawSubclip({
    mobId: sequenceMobId, binPath: scratchPath, useMarks: false, useClipBounds: false,
    trackList: [{ type: v1.type, number: v1.number }],
    headTimecode: target.rec_in, endTimecode: target.rec_out,
  })
  if (!aItems.length) throw new Error('source-handle step 1 made no subclip for the playhead clip')
  const a = aItems[0]
  const aCols = await getMobColumns(a.mobId).catch(() => ({}))
  const aDur = durFrames(aCols, fps)
  logMcapiVerbose('source-handle step1 (scratch subclip of source)', { mob: a, start: pick(aCols, ['Start']), end: pick(aCols, ['End']), dur: aDur })

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
      return { exportMob: a, created: aItems, headHandles: 0, endHandles: 0 }
    }
  }

  if (!bItems.length) throw new Error('source-handle step 2 produced no subclip in ' + destPath)
  logMcapiVerbose('source-handle step2 (in working bin)', { mob: bItems[0], head, end })
  return { exportMob: bItems[0], created: bItems, headHandles: head, endHandles: end }
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
// Read markers on a mob (the subclip retains them). Returns [{name, comment, offset}].
export async function getMarkers(mobId) {
  const client = requireClient()
  const req = new GetMarkersRequest()
  const body = new GetMarkersRequestBody()
  body.setMobId(mobId)
  req.setBody(body)
  const res = await callUnary(client, 'getMarkers', req, getAccessTokenMetadata())
  const b = res && res.getBody ? res.getBody() : null
  const infos = b && b.getInfoList ? b.getInfoList() : []
  const out = infos.map((i) => ({
    name: i.getName ? i.getName() : '',
    comment: i.getComment ? i.getComment() : '',
    offset: i.getOffset ? i.getOffset() : 0,
  }))
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
  const r = await grabSourceHandledMob({ sequenceMobId: shot.mobId, playheadTC: shot.playheadTC, parseEdl, destBinPath, handles })
  const sequence = r.exportMob
  const created = r.created

  // Prefer the marker comment as the shot name; rename the sequence + subclip(s).
  let name = sequence.mobName || shot.name
  try {
    const label = markerLabel(await getMarkers(sequence.mobId))
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
