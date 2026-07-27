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
  ViewerType,
} from '~/utils/grpc-web/MCAPI_Types_pb.js'
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
export async function createSubclipFromMarks({ sequenceMobId, destBinPath }) {
  const client = requireClient()
  const F = GetListOfBinItemsRequestBody.BinItemFlags
  await ensureBin(destBinPath)
  const binPath = await resolveBinPath(destBinPath)

  // Snapshot all items + just the sequences, so we can find both the new
  // subclip(s) and the new sequence (the export target).
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
  body.setCreateNewSequence(true) // a sequence so ExportFile accepts it
  body.setEnabledTracksOnly(false)
  body.setRetainMarkers(true)
  body.setAddFramesAtHead(0)
  body.setAddFramesAtEnd(0)
  req.setBody(body)
  await callUnary(client, 'createSubClip', req, getAccessTokenMetadata())

  const afterAll = await listBinItems(binPath)
  const created = afterAll.filter((i) => !beforeAllIds.has(i.mobId))
  if (!created.length) {
    throw new Error('Subclip created but could not be located in ' + binPath +
      ' (is IN/OUT marked on the timeline?)')
  }
  // The export target is the new SEQUENCE.
  let sequence = null
  if (F) {
    const afterSeq = await listBinItems(binPath, [F.SEQUENCES]).catch(() => [])
    sequence = afterSeq.find((i) => !beforeSeqIds.has(i.mobId)) || null
  }
  if (!sequence) sequence = created[0] // fallback
  return { sequence, created }
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
// Grab the marked shot, export it to `exportDir`, return { shot, referencePath }.
export async function grabMarkedShot({ exportDir, destBinPath, exportSettingsName, fileName = 'ref.mov' }) {
  const shot = await getCurrentShot()
  const { sequence, created } = await createSubclipFromMarks({ sequenceMobId: shot.mobId, destBinPath })

  // Prefer the marker comment inside the grabbed range as the shot name, and
  // rename BOTH the new sequence and its subclip(s) to match (markers retained
  // via retain_markers).
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
  // Name the exported movie after the shot (marker comment); MC adds the ext.
  const safeBase = String(name || fileName || 'ref')
    .replace(/[/\\:*?"<>|]+/g, '_')
    .trim() || 'ref'
  const outputPath = exportDir.replace(/\/$/, '') + '/' + safeBase
  const referencePath = await exportMob({
    mobId: sequence.mobId,
    outputPath,
    exportSettingsName,
  })
  // Use the SUBCLIP's own Start/End (the grabbed shot), not the sequence's.
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
    referencePath,
    sequenceMobId: sequence.mobId,
    createdMobIds: created.map((i) => i.mobId),
  }
}

// HH:MM:SS:FF -> total frames (non-drop; TC labels at round(fps)).
function tcToFrames(tc, fps) {
  const p = String(tc || '').split(/[:;]/).map((n) => parseInt(n, 10))
  if (p.length < 4 || p.some(isNaN)) return 0
  const [hh, mm, ss, ff] = p
  return ((hh * 60 + mm) * 60 + ss) * fps + ff
}
