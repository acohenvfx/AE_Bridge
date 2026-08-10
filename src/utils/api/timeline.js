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
  GetListOfExportEDLSettingsRequest,
  GetListOfExportEDLSettingsRequestBody,
  GetMarkersRequest,
  GetMarkersRequestBody,
  GetListOfCommandsRequest,
  GetListOfCommandsRequestBody,
  SelectMobsInBinRequest,
  SelectMobsInBinRequestBody,
  DoCommandRequest,
  DoCommandRequestBody,
  IsCommandsEnabledRequest,
  IsCommandsEnabledRequestBody,
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
import {
  clipsForTrack,
  hasNumberedUpperTracks,
  pickClipForSegment,
  plateNameForTrack,
  preferredEdlSetting,
  withPlateSuffix,
} from '~/utils/api/edlPlan.mjs'
import { recoverEdl } from '~/utils/api/aebridge.js'
import { tcToFrames, durationToFrames } from '~/utils/api/timecode.mjs'
import { narrowToSelection, lowestTrack } from '~/utils/api/trackSelection.mjs'

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
export async function getViewerMobs(timeoutMs = 30000) {
  const client = requireClient()
  const req = new GetViewerMobsRequest()
  req.setBody(new GetViewerMobsRequestBody())
  const res = await callUnary(client, 'getViewerMobs', req, getAccessTokenMetadata(), timeoutMs)
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
  // MARKS ARE READABLE after all — the record sequence's own columns carry
  // `Mark IN` / `Mark OUT` (CONFIRMED in Avid 2026-07-29). An earlier session
  // concluded marks were unreachable because GetValues is test-only and
  // ExportEDL ignores them; nobody checked GetMobInfo's columns.
  const markIn = pick(cols, ['Mark IN']) || ''
  const markOut = pick(cols, ['Mark OUT']) || ''
  return {
    mobId: seq.mobId,
    name: pick(cols, ['Name']) || 'sequence',
    startTC: pick(cols, ['Start']),
    playheadTC: seq.currentTimecode,
    playheadFrame: seq.currentFrame,
    markIn,
    markOut,
    frameRate,
    dropFrame: project.dropFrame || /;/.test(seq.currentTimecode || ''),
    resolution,
    columns: cols,
  }
}

// Every V1 clip inside the sequence's marked range — one shot per clip, which
// is one comp and one job. Each shot also carries its own plate stack (the
// tracks above it over that clip's span), so a marked range spanning three
// stacked shots enumerates the whole grid in one pass.
//
// Nothing here moves the playhead: `findClipAtPlayhead` is just "the clip at
// this TC", and CreateSubClip takes an arbitrary `head_frame`, so any clip in
// the range can be targeted directly.
export async function analyzeRange({ parseEdl }) {
  const shot = await getCurrentShot()
  const fps = 24
  if (!shot.markIn || !shot.markOut) {
    throw new Error('No IN/OUT marks on the record sequence. Mark the range you want, then Analyze range.')
  }
  const inF = tcToFrames(shot.markIn, fps)
  const outF = tcToFrames(shot.markOut, fps)
  // Sequence start, for converting absolute EDL timecodes into the
  // sequence-relative frames CreateSubClip's head_frame expects.
  const seqStartF = tcToFrames(shot.startTC || '00:00:00:00', fps)
  if (!(outF > inF)) {
    throw new Error('Mark OUT (' + shot.markOut + ') is not after Mark IN (' + shot.markIn + ').')
  }

  const allTracks = await getMobTrackInfo(shot.mobId)
  const withContent = allTracks
    .filter((t) => t.type === TRACKTYPE_PICTURE && t.numSegments > 0)
    .sort((a, b) => a.number - b.number)
  // Selected track heads narrow the scan the same way analyzeStack does — see
  // trackSelection.mjs. The ANCHOR (ordinarily V1) is whichever track ends up
  // lowest after narrowing: its EDL is what defines shot boundaries below
  // (cuts define shots), and its marker names every shot in the range.
  const vids = narrowToSelection(withContent)
  const anchor = lowestTrack(vids)
  if (!anchor) {
    throw new Error(vids.length !== withContent.length
      ? 'No selected video track has content on this sequence.'
      : 'No video track with content on this sequence.')
  }

  // One all-track EDL is split locally and reused for every shot. If Avid's
  // selected List Tool format omits track labels, loadTrackEdls falls back to
  // paced per-track requests. A failed track is never silently dropped.
  const edls = await loadTrackEdls({ mobId: shot.mobId, sequenceName: shot.name, tracks: vids, parseEdl })

  // CUTS DEFINE SHOTS; MARKERS ONLY NAME THEM. One shot per ANCHOR-track EDL
  // event — including through-edits: this preset reports a cut with
  // CONTINUING source timecode as two events (confirmed 2026-08-06: src_out
  // 00:07:45:08 → src_in 00:07:45:09), so "the cut on a continuous clip" is
  // visible here. An earlier version also split clips at V1 markers, treating
  // them as cut points. That was refuted the same day it was really tested:
  // the user's markers sit MID-shot as labels, so marker boundaries chopped
  // every real clip into two half-shots, both halves grabbed identical media
  // (see the CreateSubClip explicit-frames fact — bounding doesn't work
  // anyway) and converged on the same name — "2 of each clip". A truly uncut
  // clip spanning several shots is, per the user's own rule, ONE clip; the
  // editor splits it by adding a through-edit in Avid, not by dropping
  // markers.
  //
  // The anchor is V1 unless the editor narrowed the analysis by SELECTING
  // other tracks (see trackSelection.mjs) — e.g. only V14-16 selected on a
  // 20-track sequence makes V14 the anchor, and shots are then defined by
  // V14's cuts rather than V1's.
  //
  // An anchor clip is in range if it OVERLAPS [markIn, markOut) — a range
  // that starts mid-clip still means the editor wants that shot.
  const shots = []
  for (const c of edls[anchor.number] || []) {
    const cIn = tcToFrames(c.rec_in, fps)
    const cOut = tcToFrames(c.rec_out, fps)
    if (cOut <= inF || cIn >= outF) continue
    // Target position, just inside the clip so clip-bounds subclipping
    // resolves to THIS clip and not a neighbour.
    //
    // Two different frame spaces, and mixing them is the trap: EDL timecodes
    // are ABSOLUTE (01:02:37:02), but CreateSubClip's `head_frame` is
    // relative to the SEQUENCE START — Avid's own `currentFrame` confirms it
    // (4804 for 01:03:20:04 on a sequence starting 01:00:00:00). Passing an
    // absolute frame asks for a position far past the end and Avid answers
    // with the misleading "Invalid add_frame_at_head: Requested frames not
    // available."
    const atFrameAbs = Math.min(cIn + 1, cOut - 1)
    const atFrameSeq = atFrameAbs - seqStartF
    const stack = []
    for (const t of vids) {
      // Overlap with the whole clip span, not containment of one frame — an
      // upper plate starting partway into the shot is the normal shape of a
      // stack. See pickClipForSegment.
      const picked = pickClipForSegment(
        (edls[t.number] || []).map((x) => ({
          clip: x,
          in: tcToFrames(x.rec_in, fps),   // absolute
          out: tcToFrames(x.rec_out, fps), // absolute
        })),
        cIn,
        cOut
      )
      const hit = picked ? picked.clip : null
      if (hit) {
        stack.push({
          track: t.number,
          enabled: t.enabled,
          clipName: hit.clip_name,
          recIn: hit.rec_in,
          recOut: hit.rec_out,
          srcIn: hit.src_in,
          srcOut: hit.src_out,
        })
      }
    }
    shots.push({
      atFrame: atFrameSeq,                // sequence-relative — for head_frame
      atTC: framesToTc(atFrameAbs, fps),  // absolute — for EDL lookup
      clipName: c.clip_name,
      recIn: c.rec_in,
      recOut: c.rec_out,
      stack,
    })
  }

  logMcapiVerbose('marked range', {
    markIn: shot.markIn, markOut: shot.markOut,
    seqStartTC: shot.startTC, seqStartFrame: seqStartF,
    anchorTrack: anchor.number,
    narrowedToSelection: vids.length !== withContent.length,
    shots: shots.map((s) => ({
      at: s.atTC, frame: s.atFrame, clip: s.clipName,
      plates: s.stack.map((p) => 'V' + p.track),
    })),
  })
  if (!shots.length) {
    throw new Error('No V' + anchor.number + ' clips inside ' + shot.markIn + '–' + shot.markOut + '.')
  }
  return { shot, shots, anchorTrack: anchor.number }
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

// MCAPI has no delete-mob RPC. Selecting the scratch subclips in their bin
// gives the editor a safe, one-click handoff: the user can review the count
// and press Delete in Avid. Keep the destructive keypress in Avid's UI rather
// than guessing which context-sensitive DoCommand entry means "delete bin
// items" for a particular Media Composer version.
async function listScratchSubclips(scratchBin = 'AEBridge_Scratch') {
  await ensureBin(scratchBin)
  const binPath = await resolveBinPath(scratchBin)
  const F = GetListOfBinItemsRequestBody.BinItemFlags
  const items = await listBinItems(binPath, F ? [F.SUBCLIPS] : null)
  return { binPath, items }
}

async function selectMobsInBin(binPath, mobIds) {
  if (!mobIds.length) return
  const client = requireClient()
  const req = new SelectMobsInBinRequest()
  const body = new SelectMobsInBinRequestBody()
  body.setBinPath(binPath)
  body.setMobIdsList(mobIds)
  body.setAddToSelection(false)
  req.setBody(body)
  await callUnary(client, 'selectMobsInBin', req, getAccessTokenMetadata())
  logMcapiVerbose('select scratch subclips', { binPath, count: mobIds.length })
}

export async function selectScratchSubclips(scratchBin = 'AEBridge_Scratch') {
  const { binPath, items } = await listScratchSubclips(scratchBin)
  if (items.length) await selectMobsInBin(binPath, items.map((item) => item.mobId))
  return { binPath, count: items.length }
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
export async function getMobTrackInfo(mobId, timeoutMs = 30000) {
  const client = requireClient()
  const req = new GetMobTrackInfoRequest()
  const body = new GetMobTrackInfoRequestBody()
  body.setMobId(mobId)
  req.setBody(body)
  const res = await callUnary(client, 'getMobTrackInfo', req, getAccessTokenMetadata(), timeoutMs)
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

// Video tracks that are ENABLED — strictly, not "enabled or selected". This is
// the state `enabled_tracks_only` exports from, so it is what decides whether a
// track is soloed for a clean plate grab.
export function enabledVideoTracks(tracks) {
  return (tracks || [])
    .filter((t) => t.type === TRACKTYPE_PICTURE && t.enabled && t.numSegments > 0)
    .sort((a, b) => a.number - b.number)
}

let edlSettingsPromise = null

async function getRequiredEdlSetting() {
  if (!edlSettingsPromise) {
    edlSettingsPromise = (async () => {
      const client = requireClient()
      const req = new GetListOfExportEDLSettingsRequest()
      req.setBody(new GetListOfExportEDLSettingsRequestBody())
      const res = await callUnary(client, 'getListOfExportEDLSettings', req, getAccessTokenMetadata())
      const body = res && res.getBody ? res.getBody() : null
      const names = body && body.getSettingNamesList
        ? body.getSettingNamesList().map((name) => String(name || '').trim()).filter(Boolean)
        : []
      const chosen = preferredEdlSetting(names)
      if (!chosen) {
        throw new Error('Required Avid List Tool preset “VFX toolkit edl” was not found. Available presets: ' + (names.join(', ') || 'none'))
      }
      logMcapiVerbose('EDL setting selected', chosen)
      return chosen
    })().catch((error) => {
      edlSettingsPromise = null
      throw error
    })
  }
  return edlSettingsPromise
}

function makeExportEdlRequest(mobId, track, settingName) {
  const req = new ExportEDLRequest()
  const body = new ExportEDLRequestBody()
  body.setMobId(mobId)
  body.setEdlSettingsName(settingName)
  if (track) {
    const tl = new TrackList()
    const lbl = new TrackLabel()
    lbl.setType(track.type)
    lbl.setNumber(track.number)
    tl.setTrackLabelsList([lbl])
    body.setTrackList(tl)
  }
  req.setBody(body)
  return req
}

function isEdlFileSaveFailure(error) {
  return /EDL file not saved|ErrorType["':\s]+1000/i.test(String((error && error.message) || error))
}

function edlFileSaveFailure(error) {
  const detail = String((error && error.message) || error || '')
  return new Error(
    'Media Composer could not create its temporary EDL. AEBridge stopped after one request ' +
    'so it will not exhaust Avid\'s three-digit EDL filename counter. ' +
    'Use the List Tool once or clear its generated EDL export files, then retry Analyze. ' + detail
  )
}

async function requestEdlPath(mobId, track, sequenceName = '') {
  const client = requireClient()
  const settingName = await getRequiredEdlSetting()
  const req = makeExportEdlRequest(mobId, track, settingName)
  logMcapiVerbose('exportEDL request', {
    setting: settingName,
    track: track ? 'V' + track.number : 'all',
  })
  let res
  const startedAt = Date.now()
  try {
    res = await callUnary(client, 'exportEDL', req, getAccessTokenMetadata(), 120000)
  } catch (error) {
    if (isEdlFileSaveFailure(error)) {
      try {
        const recovered = await recoverEdl(sequenceName, startedAt)
        if (recovered && recovered.edl_path) {
          logMcapiVerbose('exportEDL recovered after Avid error 1000', {
            track: track ? 'V' + track.number : 'all',
            path: recovered.edl_path,
            modifiedMs: recovered.modified_ms,
          })
          return recovered.edl_path
        }
      } catch (recoveryError) {
        logMcapiVerbose('exportEDL recovery found no fresh matching file', recoveryError.message)
      }
      throw edlFileSaveFailure(error)
    }
    throw error
  }
  const b = res && res.getBody ? res.getBody() : null
  const path = b && b.getPath ? String(b.getPath() || '').trim() : ''
  const dialogs = b && b.getDialogContentsList ? b.getDialogContentsList() : []
  if (dialogs.length) logMcapiVerbose('exportEDL dialog contents', dialogs)
  if (!path) throw new Error('Media Composer returned no EDL path')
  logMcapiVerbose('exportEDL path ' + (track ? 'V' + track.number : 'all'), path)
  return path
}

// Run ExportEDL for one track; retained as a bounded fallback when a facility's
// all-track EDL format does not preserve V2/V3/etc. labels.
export async function exportEdlForTrack(mobId, track, sequenceName = '') {
  return requestEdlPath(mobId, track, sequenceName)
}

async function parseTrackEdl({ mobId, sequenceName, track, parseEdl }) {
  if (!parseEdl) return []
  const path = await requestEdlPath(mobId, track, sequenceName)
  return parseEdl(path)
}

async function loadTrackEdls({ mobId, sequenceName, tracks, parseEdl }) {
  if (!parseEdl) return {}
  let allClips = null
  try {
    const path = await requestEdlPath(mobId, null, sequenceName)
    allClips = await parseEdl(path)
    logMcapiVerbose('all-track EDL parsed', { clips: allClips.length })
  } catch (error) {
    if (isEdlFileSaveFailure(error) || /three-digit EDL filename counter/i.test(error.message || '')) {
      throw error
    }
    logMcapiVerbose('all-track EDL unavailable — using paced per-track fallback', error.message)
  }

  const needsPerTrack = !allClips || (tracks.length > 1 && !hasNumberedUpperTracks(allClips))
  if (!needsPerTrack) {
    const byTrack = {}
    for (const track of tracks) byTrack[track.number] = clipsForTrack(allClips, track)
    return byTrack
  }

  if (allClips && tracks.length > 1) {
    logMcapiVerbose('all-track EDL did not preserve upper-track labels — using paced per-track fallback')
  }
  const byTrack = {}
  for (let i = 0; i < tracks.length; i += 1) {
    const track = tracks[i]
    if (i) await new Promise((resolve) => setTimeout(resolve, 350))
    byTrack[track.number] = await parseTrackEdl({ mobId, sequenceName, track, parseEdl })
  }
  return byTrack
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
// Add source handles, degrading deterministically when the source media does
// not have them. Different clips on the same track hit different source
// positions, so one shot can have handles at both edges and its neighbour none.
//
// The ladder is explicit rather than parsed out of Avid's error text: an earlier
// message-driven version could dead-end (Avid reports `add_frame_at_head` even
// once head is 0) and throw, failing the whole grab over a missing handle.
// Handle availability must NEVER fail a grab — a plate with no handles is
// still a usable plate.
async function extendWithHandles({ mobId, binPath, handles }) {
  const h = Math.max(0, Number(handles) || 0)
  const ladder = h > 0
    ? [[h, h], [0, h], [h, 0], [0, 0]]  // both, tail-only, head-only, exact
    : [[0, 0]]
  let lastError = null
  for (const [head, end] of ladder) {
    try {
      const items = await createRawSubclip({
        mobId, binPath, useMarks: false, useClipBounds: true, trackList: null,
        addFramesHead: head, addFramesEnd: end,
      })
      if (items.length) {
        if (head !== h || end !== h) {
          logMcapiVerbose('handles clamped by available source media', { requested: h, head, end })
        } else {
          logMcapiVerbose('handles applied', { requested: h, head, end })
        }
        return { items, head, end }
      }
      return { items: [], head: 0, end: 0 }
    } catch (e) {
      // Step down on ANY failure, not just recognised handle errors — the whole
      // point of the ladder is that [0,0] always works, and misreading one
      // error message must not cost the grab.
      logMcapiVerbose(
        'subclip failed at handles [' + head + ',' + end + '], stepping down' +
        (handlesUnavailable(e) ? '' : ' (UNRECOGNISED error — note the wording)'),
        e.message
      )
      lastError = e
    }
  }
  // Every rung refused, including no handles at all. Caller falls back to the
  // exact subclip it already holds.
  logMcapiVerboseError('every subclip attempt failed — caller will use the exact clip', lastError || new Error('no items returned'))
  return { items: [], head: 0, end: 0 }
}

// Find the clip under the playhead on ONE video track. Analyze Stack/Range
// supplies a targetHint so grabs reuse that result instead of exporting another
// temporary EDL. A direct grab retains one per-track EDL as a fallback.
// Returns { track, target, fps, allTracks }.
async function chooseTrackAndTarget({ sequenceMobId, sequenceName = '', atTC, parseEdl, trackNumber = 1, targetHint = null }) {
  const allTracks = await getMobTrackInfo(sequenceMobId)
  logMcapiVerbose('track info', allTracks)
  const label = 'V' + trackNumber
  const track = allTracks.find((t) => t.type === TRACKTYPE_PICTURE && t.number === trackNumber)
  if (!track) throw new Error('No ' + label + ' (video track ' + trackNumber + ') on this sequence')
  if (!track.numSegments) throw new Error(label + ' has no clips')
  if (!track.enabled) throw new Error('Enable ' + label + ' before grabbing (turn on the ' + label + ' track). Avid only exports ENABLED tracks.')
  logMcapiVerbose('chosen track', { chosen: track })
  const fps = 24

  let target = null
  if (targetHint) {
    target = {
      clip_name: targetHint.clip_name || targetHint.clipName || '',
      rec_in: targetHint.rec_in || targetHint.recIn || '',
      rec_out: targetHint.rec_out || targetHint.recOut || '',
      src_in: targetHint.src_in || targetHint.srcIn || '',
      src_out: targetHint.src_out || targetHint.srcOut || '',
    }
    if (!target.rec_in || !target.rec_out) target = null
  }
  if (!target) {
    const clips = await parseTrackEdl({ mobId: sequenceMobId, sequenceName, track, parseEdl })
    logMcapiVerbose(label + ' EDL clips', { count: clips.length, numSegments: track.numSegments, clips: clips.map((c) => ({ n: c.clip_name, in: c.rec_in, out: c.rec_out })) })
    target = findClipAtPlayhead(clips, atTC, fps)
  } else {
    logMcapiVerbose(label + ' target reused from analysis', target)
  }
  if (!target) {
    throw new Error('No ' + label + ' clip at ' + atTC + '. Park on the shot first.')
  }
  logMcapiVerbose('target clip', { atTC, clip: target.clip_name, rec_in: target.rec_in, rec_out: target.rec_out, src_in: target.src_in, src_out: target.src_out })
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
  const withContent = allTracks
    .filter((t) => t.type === TRACKTYPE_PICTURE && t.numSegments > 0)
    .sort((a, b) => a.number - b.number)
  // If the editor has SELECTED specific track heads (distinct from `enabled`
  // — see HANDOFF.md and trackSelection.mjs), only those are analyzed. A wide
  // sequence (many video tracks) can be pointed at just the ones that matter
  // instead of scanning every track with content — which also means fewer
  // EDL exports (one per track analyzed; see the "EDL filename counter" fact).
  const vids = narrowToSelection(withContent)
  const anchor = lowestTrack(vids)
  const edls = await loadTrackEdls({ mobId: shot.mobId, sequenceName: shot.name, tracks: vids, parseEdl })
  const stack = []
  for (const t of vids) {
    const clips = edls[t.number] || []
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
        srcIn: c.src_in,
        srcOut: c.src_out,
      })
    }
  }
  logMcapiVerbose('stack at playhead', {
    playheadTC: shot.playheadTC,
    tracks: stack.map((s) => 'V' + s.track),
    anchorTrack: anchor ? anchor.number : null,
    narrowedToSelection: vids.length !== withContent.length,
  })
  return { shot, stack, anchorTrack: anchor ? anchor.number : null }
}

async function grabSourceHandledMob({ sequenceMobId, sequenceName = '', atTC, atFrame, parseEdl, destBinPath, handles, trackNumber = 1, targetHint = null, scratchBin = 'AEBridge_Scratch' }) {
  await ensureBin(destBinPath)
  const destPath = await resolveBinPath(destBinPath)
  await ensureBin(scratchBin)
  const scratchPath = await resolveBinPath(scratchBin)
  const { track, target, fps, allTracks } = await chooseTrackAndTarget({ sequenceMobId, sequenceName, atTC, parseEdl, trackNumber, targetHint })
  const wantTrack = 'V' + track.number

  // ISOLATION GUARD. CreateSubClip does NOT fan one subclip per enabled track
  // (verified in Avid 2026-07-28): with V1+V2 enabled it returns ONE subclip of
  // the enabled COMPOSITE, labelled with the bottom track — its `Tracks` column
  // reads exactly "V1" while the media is V2 over V1. The columns lie, so track
  // classification cannot be trusted. The workflow already solos one plate at
  // a time, so enforce that state directly. This avoids another series of EDL
  // exports during every grab and can never produce a silent flattened plate.
  const conflicts = allTracks
    .filter((t) => t.type === TRACKTYPE_PICTURE && t.number !== track.number && t.enabled && t.numSegments > 0)
    .map((t) => 'V' + t.number)
  if (conflicts.length) {
    throw new Error(
      'Enable ONLY ' + wantTrack + ' to grab this plate — ' + conflicts.join(', ') +
      ' also has a clip there, and Avid would export ' + wantTrack +
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
  const headFrame = Number.isInteger(atFrame) ? atFrame : tcToFrames(atTC, fps)
  // head_frame is SEQUENCE-RELATIVE. An absolute TC frame (e.g. 90170 for
  // 01:02:37:02) sails past the end and Avid reports it as
  // "Invalid add_frame_at_head: Requested frames not available." — which sent
  // this hunt off after the handle code twice. Catch it here with a message
  // that says what is actually wrong.
  const seqDur = Number(pick(await getMobColumns(sequenceMobId).catch(() => ({})), ['Frame Count Duration'])) || 0
  if (headFrame < 0 || (seqDur && headFrame >= seqDur)) {
    throw new Error(
      'Internal: head_frame ' + headFrame + ' is outside the sequence (0–' + (seqDur || '?') +
      '). head_frame must be relative to the sequence start, not an absolute timecode frame.'
    )
  }
  // NO explicit end bound here — CreateSubClip IGNORES explicit
  // head_frame/end_frame spans, exactly as it ignores track_list. PROVEN
  // 2026-08-06: a grab asking for frames 3769-4036 (267 frames) with
  // use_clip_bounds=false returned the full 624-frame clip, on every one of
  // six segments. The only working shape is use_clip_bounds=true + head_frame
  // = "the whole clip under this position", which is what shots are.
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
  // Handles are BEST-EFFORT BY DEFINITION. No failure in here may fail the
  // grab: whatever goes wrong, the exact subclip from step 1 is already a
  // correct plate. Matching on Avid's error wording proved fragile (see the
  // ladder), so this catches everything rather than trusting a regex.
  let bItems = []
  let head = 0
  let end = 0
  try {
    const ext = await extendWithHandles({ mobId: a.mobId, binPath: destPath, handles })
    bItems = ext.items
    head = ext.head
    end = ext.end
  } catch (e) {
    logMcapiVerboseError('handles failed outright — exporting the exact clip instead', e)
  }
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
    // No handled subclip at all (the source has no spare frames at either
    // edge). The exact scratch subclip is already correct — export that rather
    // than failing the grab over missing handles.
    logMcapiVerbose('no handled subclip — exporting the exact clip with 0 handles', { mob: a.mobName })
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
// `anchorTrack` is which track NAMES the stack — ordinarily V1, but a
// selection-narrowed analysis (see trackSelection.mjs) can make it any track,
// e.g. V14 when only V14-16 were selected. Defaults to 1 for a bare single-
// plate grab with no stack/range plan behind it, where there's nothing else
// to anchor to.
export async function grabShot({ destBinPath, handles = 0, parseEdl = null, trackNumber = 1, anchorTrack = 1, baseName = '', atTC = '', atFrame = null, targetHint = null }) {
  const shot = await getCurrentShot()
  // Default to the playhead; a range grab passes the target clip's position so
  // several shots can be grabbed without the editor moving anything.
  const tc = atTC || shot.playheadTC
  const frame = Number.isInteger(atFrame) ? atFrame : shot.playheadFrame
  // Grab the clip under the playhead from its SOURCE master (handles from the
  // source's own media, never the sequence timeline).
  const r = await grabSourceHandledMob({ sequenceMobId: shot.mobId, sequenceName: shot.name, atTC: tc, atFrame: frame, parseEdl, destBinPath, handles, trackNumber, targetHint })
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
      // The search window is the CLIP's record span: cuts define shots, and a
      // marker anywhere inside the clip is its label. The ±2 tolerance covers
      // TC-string round-tripping (rec_in/rec_out went through tcToFrames).
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
      const phF = Number.isInteger(frame) ? frame : null
      const chosen = (phF != null && within.length > 1)
        ? [within.slice().sort((a, b) => Math.abs((a.offset || 0) - phF) - Math.abs((b.offset || 0) - phF))[0]]
        : within
      marker = markerLabel(chosen)
      logMcapiVerbose('marker for V' + trackNumber, { inF, outF, playheadFrame: phF, count: within.length, marker })
    }
    // Fall back to any marker the subclip itself retained — ANCHOR TRACK ONLY.
    // This read has no track filter and no span filter (a subclip's markers
    // carry neither reliably), so on an UPPER track it will happily return a
    // marker belonging to the anchor. That was harmless while every subclip
    // spanned a whole clip, but a marker-split segment (see analyzeRange)
    // starts EXACTLY on a marker, and `createRawSubclip` sets
    // retainMarkers:true — so the segment's subclip retains the anchor's
    // marker at its own frame 0 and every upper plate in the stack came back
    // named after it. Reported live (when the anchor was V1): the top plate
    // of a stack taking V1's `..._pl01` name. An upper track with no marker
    // of its own is supposed to fall through to the `_plNN` form, which is
    // exactly what skipping this does.
    if (!marker && trackNumber === anchorTrack) {
      marker = markerLabel(await getMarkers(sequence.mobId).catch(() => []))
    }
  } catch (e) {
    logMcapiVerbose('marker read failed', e.message)
  }

  // Naming. The first pass (the ANCHOR track — ordinarily V1, see
  // analyzeStack/analyzeRange) names the whole stack from its marker — always
  // suffixed _pl01 (withPlateSuffix), even when the marker is just the bare
  // shot name, so the anchor's own plate reads as part of the stack the same
  // way every upper plate already does. An upper track prefers its OWN
  // marker as-is; `_plNN` is only the fallback for a track that has no
  // marker of its own.
  const name = baseName || marker || sequence.mobName || shot.name
  // Upper fallback REPLACES the base's trailing _plNN rather than appending —
  // the anchor's marker comment routinely carries _pl01 already, and
  // appending produced `<shot>_pl01_pl02`. A plate carries exactly one
  // _plNN: its own. Note the literal `1` in withPlateSuffix is a STACK
  // POSITION (the anchor is always plate 1 of its stack), not the Avid track
  // number — unlike plateNameForTrack's `_plNN`, which upper plates suffix
  // with their real track number.
  const plateName = trackNumber === anchorTrack
    ? withPlateSuffix(name, 1)
    : (marker || plateNameForTrack(name, trackNumber))
  logMcapiVerbose('plate name', { track: 'V' + trackNumber, anchorTrack, marker: marker || null, base: name, plateName, fromMarker: !!(trackNumber !== anchorTrack && marker) })
  for (const item of created) {
    await renameMob(item.mobId, plateName).catch((e) => logMcapiVerbose('rename failed', { id: item.mobId, err: e.message }))
  }
  logMcapiVerbose('grabbed plate', { track: 'V' + trackNumber, name: plateName, recIn: r.target && r.target.rec_in, head: r.headHandles, end: r.endHandles })

  const subCols = await getMobColumns(sequence.mobId).catch(() => ({}))
  const startTC = pick(subCols, ['Start', 'Mark IN'])
  const endTC = pick(subCols, ['End', 'Mark OUT'])
  const fps = Math.round(parseFloat(shot.frameRate) || 24)

  // FIXED 2026-08-07: every plate ever grabbed carried frame_count 0.
  //
  // These columns belong to the SUBCLIP just created, so they describe the
  // exported plate itself, handles included — verified frame-for-frame against
  // the .mov (427 frames from Start/End, 427 from `Duration`, 427 from the
  // native probe).
  //
  // The old chain was `durTC ? tcToFrames(durTC) : (end - start)`, and Avid's
  // `Duration` reads RIGHT-ALIGNED (`17:19`), which tcToFrames rejects for
  // having fewer than four fields. So a present Duration shadowed the
  // end−start fallback and the result was always 0. Order now runs
  // most-reliable first, and the Duration path uses a duration-aware parser.
  let frameCount = Number(pick(subCols, ['Duration Frames'])) || 0
  if (!frameCount) frameCount = tcToFrames(endTC, fps) - tcToFrames(startTC, fps)
  if (!frameCount) frameCount = durationToFrames(pick(subCols, ['Duration']), fps)
  if (!frameCount || frameCount < 0) frameCount = 0
  if (!frameCount) {
    // Never silent: a 0 here disables the return-validation frame-count gate
    // (service/media.py treats <= 0 as "never captured"), so it must be
    // visible in the log rather than discovered later at Import.
    logMcapiVerbose('frame_count unresolved', {
      plate: plateName,
      start: startTC || null,
      end: endTC || null,
      duration: pick(subCols, ['Duration']) || null,
      durationFrames: pick(subCols, ['Duration Frames']) || null,
    })
  }

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
      record_tc_in: startTC || tc,
      record_tc_out: endTC || '',
      source_tc_in: startTC || '',
      frame_rate: shot.frameRate,
      drop_frame: shot.dropFrame,
      resolution: shot.resolution,
      frame_count: frameCount,
    },
  }
}

export { plateOffsets } from '~/utils/api/plateOffsets.mjs'

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
  // If track commands turn out to need the timeline focused, the fix is to
  // activate it first — so surface anything that looks like a window/focus
  // command alongside the track ones.
  const windowish = cmds.filter((c) =>
    /^Windows/i.test(c.category) || /timeline|window|focus|activate/i.test(c.name))
  // Scratch-bin cleanup has no dedicated MCAPI delete RPC. Before attempting
  // to drive Avid's command layer, surface only commands whose names suggest
  // they can remove selected bin items. This is intentionally diagnostic:
  // command names and availability vary with Avid context, so cleanup must
  // not guess at a destructive command.
  const cleanupish = cmds.filter((c) =>
    /delete|remove|trash|clear/i.test(c.name + ' ' + c.category))
  logMcapiVerbose('commands: total', cmds.length)
  logMcapiVerbose('commands: categories', Array.from(new Set(cmds.map((c) => c.category))).join(', '))
  logMcapiVerbose('commands: track-related', trackish)
  logMcapiVerbose('commands: window/focus candidates', windowish)
  logMcapiVerbose('commands: cleanup candidates', cleanupish)
  return { commands: cmds, trackRelated: trackish, windowRelated: windowish, cleanupRelated: cleanupish }
}

// --- driving Avid commands -------------------------------------------------
// CONFIRMED 2026-07-28: with `avid.mediacomposer.command` declared, the panel
// gets 730 commands, including a **Tracks** category with one entry per track
// (`V1`…`V24`, `A1`…`A24`). Those are the timeline track-selector buttons, so
// the panel CAN toggle track enable after all — which is what makes the plate
// stack grabbable without the user touching the timeline.
//
// The ids are NOT sequential (V1=6231, V2=6230, V3=6176 …), so never hardcode
// them: look them up by name at runtime. Cached per session.
let _trackCommandMap = null

export async function getTrackCommandMap() {
  if (_trackCommandMap) return _trackCommandMap
  const { commands } = await probeCommands()
  const map = {}
  for (const c of commands) {
    if (c.category === 'Tracks' && /^[VA]\d+$/.test(c.name)) map[c.name] = c.id
  }
  logMcapiVerbose('track command map', map)
  _trackCommandMap = map
  return map
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Avid runs ONE command at a time. DoCommand returns before the command has
// finished, so firing two back to back gets:
//   code=2 {"ErrorMessage":"Can't start more than one command on time.","ErrorType":73}
// That is a BUSY signal, not a refusal — the same "RPC returns early" trap as
// ExportFile. Back off and retry.
function isCommandBusy(e) {
  const m = String((e && e.message) || '')
  return /more than one command/i.test(m) || /"ErrorType":\s*73/.test(m)
}

export async function doCommand(commandId, { retries = 10, waitMs = 200 } = {}) {
  const client = requireClient()
  for (let attempt = 0; ; attempt += 1) {
    try {
      const req = new DoCommandRequest()
      const body = new DoCommandRequestBody()
      body.setCommandid(commandId) // NB: generated setter is setCommandid
      req.setBody(body)
      await callUnary(client, 'doCommand', req, getAccessTokenMetadata())
      return
    } catch (e) {
      if (attempt >= retries || !isCommandBusy(e)) throw e
      const wait = waitMs * (attempt + 1) // linear backoff
      logMcapiVerbose('command busy, retrying', { commandId, attempt: attempt + 1, wait })
      await sleep(wait)
    }
  }
}

// Is Avid currently willing to run these commands? A command that is greyed
// out (wrong window focused, no timeline active) reports enable=false — which
// distinguishes "Avid refused" from "Avid ran it but nothing moved".
export async function isCommandEnabled(commandIds) {
  const client = requireClient()
  const req = new IsCommandsEnabledRequest()
  const body = new IsCommandsEnabledRequestBody()
  body.setCommandsidList(commandIds)
  req.setBody(body)
  const res = await callUnary(client, 'isCommandsEnabled', req, getAccessTokenMetadata())
  const b = res && res.getBody ? res.getBody() : null
  const list = b && b.getCommandsList ? b.getCommandsList() : []
  const out = {}
  for (const c of list) {
    out[c.getCommandid ? c.getCommandid() : '?'] = c.getEnable ? !!c.getEnable() : null
  }
  return out
}

// Compact record of one track's full state — `enabled` is what export uses,
// but a Tracks command might be moving `selected` or `monitored` instead, and
// only a full before/after tells us which.
function trackSnapshot(tracks, trackNumber) {
  const t = (tracks || []).find((x) => x.type === TRACKTYPE_PICTURE && x.number === trackNumber)
  if (!t) return null
  return { enabled: !!t.enabled, selected: !!t.selected, monitored: !!t.monitored }
}

// Wait until a track's enable state actually reflects what we asked for.
// Doing this between toggles paces the commands (so Avid is never asked to
// start a second one mid-flight) AND verifies each step really landed.
async function waitForTrackEnabled(sequenceMobId, trackNumber, want, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now())
    last = await getMobTrackInfo(sequenceMobId, Math.min(1000, remaining))
    const t = last.find((x) => x.type === TRACKTYPE_PICTURE && x.number === trackNumber)
    if (t && !!t.enabled === !!want) return last
    await sleep(120)
  }
  return null
}

// Enable exactly `trackNumber` among `stackTracks`, leaving every other track
// alone. The Tracks commands are TOGGLES, not setters, so we read the current
// state and flip only what differs — then RE-READ to verify, because a wrong
// enable state silently produces a flattened plate.
export async function soloVideoTrack({ sequenceMobId, trackNumber, stackTracks }) {
  const map = await getTrackCommandMap()
  const scope = (stackTracks && stackTracks.length) ? stackTracks : [trackNumber]
  const before = await getMobTrackInfo(sequenceMobId)
  let before0 = before // reused for the first toggle's before/after diff
  const toggles = []
  for (const t of before) {
    if (t.type !== TRACKTYPE_PICTURE || !scope.includes(t.number)) continue
    const want = t.number === trackNumber
    if (!!t.enabled === want) continue
    const id = map['V' + t.number]
    if (id == null) {
      throw new Error('Avid exposes no "V' + t.number + '" track command, so it cannot be toggled automatically. Solo it by hand, or turn off Auto-solo.')
    }
    toggles.push({ track: t.number, id })
  }
  logMcapiVerbose('solo V' + trackNumber, { toggling: toggles.map((x) => 'V' + x.track) })
  // One at a time, each confirmed before the next — Avid refuses a second
  // command while the first is still running.
  for (const x of toggles) {
    const want = x.track === trackNumber
    // Ask Avid whether it will even run this before blaming the result.
    let enabledMap = {}
    try {
      enabledMap = await isCommandEnabled([x.id])
    } catch (e) {
      logMcapiVerbose('isCommandsEnabled failed', e.message)
    }
    const before = trackSnapshot(before0 || (await getMobTrackInfo(sequenceMobId)), x.track)
    logMcapiVerbose('toggle V' + x.track, { id: x.id, want, commandEnabled: enabledMap[x.id], before })

    await doCommand(x.id)

    const ok = await waitForTrackEnabled(sequenceMobId, x.track, want)
    if (!ok) {
      // Log the FULL state so we can tell a no-op from a command that moved a
      // DIFFERENT field (selected/monitored) than the one export reads.
      const after = trackSnapshot(await getMobTrackInfo(sequenceMobId), x.track)
      const moved = before && after
        ? Object.keys(after).filter((k) => after[k] !== before[k])
        : []
      logMcapiVerbose('toggle V' + x.track + ' DID NOT TAKE', {
        commandEnabled: enabledMap[x.id], before, after, fieldsThatMoved: moved,
      })
      throw new Error(
        'Toggled V' + x.track + ' but its enable state never changed' +
        (enabledMap[x.id] === false ? ' (Avid reports the command is disabled right now — the timeline window probably needs focus)' : '') +
        (moved.length ? ' — but ' + moved.join(', ') + ' DID change, so the command moves a different flag than export reads' : '') +
        '. Set the tracks by hand and grab again; the log has the before/after.'
      )
    }
    before0 = null // only the first iteration can reuse the pre-read state
  }

  const after = await getMobTrackInfo(sequenceMobId)
  const on = enabledVideoTracks(after).filter((t) => scope.includes(t.number)).map((t) => t.number)
  const ok = on.length === 1 && on[0] === trackNumber
  logMcapiVerbose('solo V' + trackNumber + ' verify', { enabledInStack: on, ok })
  if (!ok) {
    throw new Error(
      'Could not solo V' + trackNumber + ' — after toggling, enabled: ' +
      (on.map((n) => 'V' + n).join(', ') || 'none') + '. Set the tracks by hand and grab again.'
    )
  }
  return after
}

// Put the enable state back the way we found it, so automating the grab does
// not quietly leave the editor's timeline rearranged.
export async function restoreTrackEnableState({ sequenceMobId, desired }) {
  const map = await getTrackCommandMap()
  const now = await getMobTrackInfo(sequenceMobId)
  const toggles = []
  for (const t of now) {
    if (t.type !== TRACKTYPE_PICTURE) continue
    if (!(t.number in desired)) continue
    if (!!t.enabled === !!desired[t.number]) continue
    const id = map['V' + t.number]
    if (id != null) toggles.push({ track: t.number, id })
  }
  logMcapiVerbose('restore track enable', { toggling: toggles.map((x) => 'V' + x.track) })
  for (const x of toggles) {
    await doCommand(x.id)
    await waitForTrackEnabled(sequenceMobId, x.track, !!desired[x.track])
  }
}

// Export the grabbed shot to `exportDir`, named after the shot. Returns the path.
export async function exportShot({ mobId, exportDir, fileName, exportSettingsName }) {
  const safeBase = String(fileName || 'ref').replace(/[/\\:*?"<>|]+/g, '_').trim() || 'ref'
  const outputPath = exportDir.replace(/\/$/, '') + '/' + safeBase
  return exportMob({ mobId, outputPath, exportSettingsName })
}

// HH:MM:SS:FF -> total frames (non-drop; TC labels at round(fps)).
// tcToFrames / durationToFrames now live in ~/utils/api/timecode.mjs so plain
// Node can unit-test them (tests/test_timecode.mjs).

// Inverse of tcToFrames (non-drop; TC labels at round(fps)).
function framesToTc(frames, fps) {
  const f = Math.max(0, Math.round(frames))
  const ff = f % fps
  const totalSec = Math.floor(f / fps)
  const ss = totalSec % 60
  const mm = Math.floor(totalSec / 60) % 60
  const hh = Math.floor(totalSec / 3600)
  const p2 = (n) => String(n).padStart(2, '0')
  return p2(hh) + ':' + p2(mm) + ':' + p2(ss) + ':' + p2(ff)
}
