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

// TrackType.TRACKTYPE_PICTURE = 0 (video)
const TRACKTYPE_PICTURE = 0
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

// --- subclip from timeline marks ------------------------------------------
export async function createSubclipFromMarks({ sequenceMobId, destBinPath, handles = 0, createNewSequence = true }) {
  const client = requireClient()
  const F = GetListOfBinItemsRequestBody.BinItemFlags
  await ensureBin(destBinPath)
  const binPath = await resolveBinPath(destBinPath)

  const beforeAll = await listBinItems(binPath).catch(() => [])
  const beforeAllIds = new Set(beforeAll.map((i) => i.mobId))
  const beforeSeqIds = new Set(
    F ? (await listBinItems(binPath, [F.SEQUENCES]).catch(() => [])).map((i) => i.mobId) : []
  )

  const req = new CreateSubClipRequest()
  const body = new CreateSubClipRequestBody()
  body.setDestinationBinPath(binPath)
  body.setMobId(sequenceMobId)
  body.setUseMarksBounds(true) // grab the editor's IN/OUT on the timeline
  body.setUseClipBounds(false)
  // head_frame/end_frame are "used when >= 0" and default to 0, which would
  // override use_marks_bounds with a 0->0 range. Set -1 so marks win.
  body.setHeadFrame(-1)
  body.setEndFrame(-1)
  // create_new_sequence=true wraps the source subclips in ONE sequence (the
  // correct, single export target). The subclips still reference the source
  // master clips, so add_frames pulls the source clip's own media (true
  // handles), clamped to available source frames.
  body.setCreateNewSequence(createNewSequence)
  body.setEnabledTracksOnly(false)
  body.setRetainMarkers(true)
  const h = Math.max(0, Number(handles) || 0)
  body.setAddFramesAtHead(h)
  body.setAddFramesAtEnd(h)
  req.setBody(body)
  await callUnary(client, 'createSubClip', req, getAccessTokenMetadata())

  const afterAll = await listBinItems(binPath)
  const created = afterAll.filter((i) => !beforeAllIds.has(i.mobId))
  if (!created.length) {
    throw new Error('Subclip created but could not be located in ' + binPath +
      ' (is IN/OUT marked on the timeline?)')
  }
  // Export target: the new sequence (if we made one) else the new subclip.
  let exportMob = null
  if (createNewSequence && F) {
    const afterSeq = await listBinItems(binPath, [F.SEQUENCES]).catch(() => [])
    exportMob = afterSeq.find((i) => !beforeSeqIds.has(i.mobId)) || null
  }
  if (!exportMob) exportMob = created[0]
  return { sequence: exportMob, created }
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

// --- track info + EDL (clip enumeration) -----------------------------------
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
  const out = infos.map((ti) => {
    const label = ti.getLabel ? ti.getLabel() : null
    return {
      type: label && label.getType ? label.getType() : 0,
      number: label && label.getNumber ? label.getNumber() : 0,
      customName: ti.getCustomName ? ti.getCustomName() : '',
      enabled: ti.getEnabled ? Boolean(ti.getEnabled()) : false,
      selected: ti.getSelected ? Boolean(ti.getSelected()) : false,
      numSegments: ti.getNumSegments ? ti.getNumSegments() : 0,
    }
  })
  logMcapiVerbose('track info', out)
  return out
}

// Enabled/selected video tracks, ordered by number (V1..Vn).
export function videoTracks(tracks, { onlyEnabledSelected = true } = {}) {
  return tracks
    .filter((t) => t.type === TRACKTYPE_PICTURE)
    .filter((t) => (onlyEnabledSelected ? (t.enabled || t.selected) : true))
    .filter((t) => t.numSegments > 0)
    .sort((a, b) => a.number - b.number)
}

// Create marks-bounded subclips of ONE track without wrapping in a sequence, so
// MC emits one subclip per clip of that track WITHIN the marked range (marks
// aren't readable via MCAPI, but CreateSubClip applies them). Returns the new
// bin items with their source Start/End columns. Used to derive the marked range.
export async function getMarkedTrackClips({ sequenceMobId, scratchBin, track }) {
  const client = requireClient()
  await ensureBin(scratchBin)
  const binPath = await resolveBinPath(scratchBin)
  const before = new Set((await listBinItems(binPath).catch(() => [])).map((i) => i.mobId))

  const req = new CreateSubClipRequest()
  const body = new CreateSubClipRequestBody()
  body.setDestinationBinPath(binPath)
  body.setMobId(sequenceMobId)
  body.setUseMarksBounds(true)
  body.setUseClipBounds(false)
  body.setHeadFrame(-1)
  body.setEndFrame(-1)
  body.setCreateNewSequence(false) // one subclip per source clip in the range
  const tl = new TrackList()
  const lbl = new TrackLabel()
  lbl.setType(track.type)
  lbl.setNumber(track.number)
  tl.setTrackLabelsList([lbl])
  body.setTrackList(tl)
  body.setRetainMarkers(true)
  body.setAddFramesAtHead(0)
  body.setAddFramesAtEnd(0)
  req.setBody(body)
  await callUnary(client, 'createSubClip', req, getAccessTokenMetadata())

  const after = await listBinItems(binPath)
  const created = after.filter((i) => !before.has(i.mobId))
  const out = []
  for (const item of created) {
    const cols = await getMobColumns(item.mobId).catch(() => ({}))
    out.push({ mobId: item.mobId, name: item.mobName, srcIn: pick(cols, ['Start']), srcOut: pick(cols, ['End']) })
  }
  logMcapiVerbose('marked V1 clips', out)
  return out
}

// Match the marked-range clips to that track's EDL events (by name, source-TC
// tiebreak) to recover their RECORD spans, then take the overall record range.
export function deriveMarkedRange(markedClips, edlEvents, fps = 24) {
  // Strip Avid subclip suffixes (.Sub.01, .new.02) so names match the EDL.
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/\.(sub|new)\.?\d*$/i, '')
  const matched = []
  for (const m of markedClips) {
    const mn = norm(m.name)
    let cands = edlEvents.filter((e) => norm(e.clip_name) === mn)
    if (!cands.length) {
      // tolerate prefix/substring (subclip name may embed the source name)
      cands = edlEvents.filter((e) => {
        const en = norm(e.clip_name)
        return en && (mn.startsWith(en) || mn.includes(en) || en.includes(mn))
      })
    }
    if (!cands.length) continue
    let best = cands[0]
    if (cands.length > 1 && m.srcIn) {
      const target = tcToFrames(m.srcIn, fps)
      best = cands.reduce((a, b) =>
        Math.abs(tcToFrames(b.src_in, fps) - target) < Math.abs(tcToFrames(a.src_in, fps) - target) ? b : a
      )
    }
    matched.push(best)
  }
  if (!matched.length) return null
  const ins = matched.map((e) => tcToFrames(e.rec_in, fps))
  const outs = matched.map((e) => tcToFrames(e.rec_out, fps))
  const lo = matched[ins.indexOf(Math.min(...ins))].rec_in
  const hi = matched[outs.indexOf(Math.max(...outs))].rec_out
  return { recIn: lo, recOut: hi, matched: matched.length }
}

// Run ExportEDL for a single track; returns the EDL file path MC wrote.
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
export async function grabShot({ destBinPath, handles = 0 }) {
  const shot = await getCurrentShot()
  const { sequence, created } = await createSubclipFromMarks({ sequenceMobId: shot.mobId, destBinPath, handles })

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
