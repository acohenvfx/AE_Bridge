<template>
  <div class="eb-tool">
    <div class="eb-tool-head">
      <div class="eb-tool-head-l">
        <!-- App name only. EB house style: display face, second word in the
             brand hue. Uses the shared .eb-brand-* classes from style.scss (EB
             puts them in its sidebar; this panel has no sidebar, so the lockup
             sits in the tool head instead). -->
        <div class="eb-brand eb-brand--inline">
          <h1 class="eb-brand-title">AE <b>Bridge</b></h1>
        </div>
      </div>
      <div class="eb-tool-head-r">
        <button
          class="eb-btn eb-btn--ghost eb-btn--mini"
          title="Drop every job whatever its state. Files on disk are untouched, and renders you already imported stay imported."
          @click="doHardReset"
        >Reset</button>
        <div class="eb-env-pill" :title="'UI build ' + uiBuild">UI {{ uiBuild }}</div>
        <div class="eb-env-pill" :class="{ 'is-bad': !s.helper.online }">
          <span class="eb-env-dot" :class="{ 'is-bad': !s.helper.online }"></span>
          {{ s.helper.online ? 'helper v' + s.helper.version : 'helper offline' }}
        </div>
        <button
          class="eb-env-pill"
          :class="{ 'is-bad': !s.ae.found }"
          :title="s.ae.found ? '' : 'Click for diagnostics'"
          @click="s.ae.found ? null : showAeDiag()"
        >
          <span class="eb-env-dot" :class="{ 'is-bad': !s.ae.found }"></span>
          {{ s.ae.found ? 'AE ' + s.ae.version : 'AE not found — why?' }}
        </button>
      </div>
    </div>

    <div class="eb-tool-body">
      <div class="eb-section">
        <div class="eb-section-head">
          <h3 class="eb-section-title">Current shot</h3>
          <!-- The readout refreshes itself; Pause lives in Diagnostics. Refresh
               only appears while paused, when it is the only way to update. -->
          <button v-if="s.pollPaused" class="eb-btn eb-btn--ghost eb-btn--mini" :disabled="reading" @click="readShot">
            {{ reading ? 'Reading…' : 'Refresh' }}
          </button>
        </div>
        <div v-if="!s.inAvid" class="eb-muted">
          Not running inside Media Composer — MCAPI unavailable. Send will use a placeholder shot.
        </div>
        <div v-else-if="s.shot" class="eb-stats">
          <span class="eb-stat"><b>{{ s.shot.name }}</b></span>
          <span class="eb-stat">TC <b>{{ s.shot.playheadTC || '—' }}</b></span>
          <span class="eb-stat"><b>{{ s.shot.resolution.w }}×{{ s.shot.resolution.h }}</b></span>
          <span class="eb-stat"><b>{{ s.shot.frameRate }}</b> fps</span>
        </div>
        <div v-else class="eb-muted">{{ s.shotMessage || 'Click Refresh to read the record monitor.' }}</div>
        <div class="eb-muted" style="font-size:11.5px">
          Park the playhead on the shot, then Analyze to see which tracks carry picture there.
        </div>
        <div v-if="s.pollPaused" class="eb-muted" style="font-size:11px">
          Updates paused (Diagnostics) — use Refresh.
        </div>
      </div>

      <div v-if="s.inAvid" class="eb-section">
        <div class="eb-section-head">
          <h3 class="eb-section-title">Plate stack</h3>
          <div class="eb-actions">
            <button class="eb-btn eb-btn--ghost eb-btn--mini" :disabled="s.analyzing" @click="doAnalyze">
              {{ s.analyzing ? 'Analyzing…' : 'Analyze stack' }}
            </button>
            <button
              class="eb-btn eb-btn--ghost eb-btn--mini"
              :disabled="s.rangeAnalyzing"
              title="Use the sequence's IN/OUT marks: one shot per V1 clip in the range, each with its own plate stack"
              @click="doAnalyzeRange"
            >{{ s.rangeAnalyzing ? 'Reading range…' : 'Analyze range' }}</button>
            <label v-if="s.stack.length" class="eb-chip" :class="{ 'is-on': s.autoGrab }" :title="'Grab each plate automatically as you solo its track in the Avid timeline'">
              <input v-model="s.autoGrab" type="checkbox" style="margin-right:6px"> Auto-grab
            </label>
            <button
              v-if="s.stack.length || s.grabbed.length"
              class="eb-btn eb-btn--ghost eb-btn--mini"
              title="Forget the plan and every grabbed plate, so you can re-grab from scratch (e.g. after deleting the subclips in Avid)"
              @click="resetStack"
            >Reset stack</button>
          </div>
        </div>

        <!-- Marked-range plan. Read-only for now: grabbing across the range is
             the next step, so this exists to verify the enumeration first. -->
        <div v-if="s.range" class="eb-callout" style="margin-bottom:10px">
          <div style="display:flex; align-items:baseline; justify-content:space-between; gap:10px">
            <b>{{ s.range.shots.length }} shot{{ s.range.shots.length === 1 ? '' : 's' }} in
              <span class="eb-mono">{{ s.range.markIn }}–{{ s.range.markOut }}</span></b>
            <button class="eb-btn eb-btn--ghost eb-btn--mini" @click="s.range = null">Hide</button>
          </div>
          <div class="range-shots">
            <div v-for="(sh, i) in s.range.shots" :key="sh.atTC" class="range-shot">
              <span class="eb-muted eb-mono" style="font-size:11px">{{ i + 1 }}</span>
              <div style="min-width:0; flex:1">
                <div class="eb-mono" style="font-size:12px; overflow-wrap:anywhere">
                  {{ sh.baseName ? withAffixes(sh.baseName) : sh.clipName }}
                </div>
                <div class="eb-muted" style="font-size:11px">{{ sh.recIn }}–{{ sh.recOut }}</div>
              </div>
              <span class="eb-mono" style="font-size:11px; white-space:nowrap">
                <span
                  v-for="p in sh.stack"
                  :key="p.track"
                  :class="(sh.grabbed || []).some(g => g.track === p.track) ? 'c-ok' : 'eb-muted'"
                >V{{ p.track }} </span>
              </span>
            </div>
          </div>
          <div class="eb-actions" style="margin-top:10px">
            <button
              v-if="rangeTracksRemaining().length"
              class="eb-btn eb-btn--primary eb-btn--mini"
              :disabled="s.grabbingTrack !== null"
              @click="doGrabTrackAcrossRange(rangeTracksRemaining()[0])"
            >{{ s.grabbingTrack !== null
                ? 'Grabbing V' + s.grabbingTrack + '…'
                : 'Grab V' + rangeTracksRemaining()[0] + ' for all shots' }}</button>
            <button
              v-if="rangeReadyCount"
              class="eb-btn eb-btn--primary eb-btn--mini"
              :disabled="s.sending"
              @click="doSendRange"
            >{{ s.sending ? 'Sending…' : 'Send ' + rangeReadyCount + ' shot' + (rangeReadyCount === 1 ? '' : 's') }}</button>
          </div>
          <div class="eb-muted" style="font-size:11px; margin-top:8px">
            <template v-if="rangeTracksRemaining().length">
              {{ s.range.totalPlates }} plates. Solo <b>only V{{ rangeTracksRemaining()[0] }}</b>
              in the timeline, then grab it for every shot at once — soloing is per track,
              not per shot.
            </template>
            <template v-else>
              All {{ s.range.totalPlates }} plates grabbed. Send makes one job per shot.
            </template>
          </div>
        </div>

        <div v-if="!s.stack.length" class="eb-muted">
          Analyze reads each video track's EDL to find every clip under the playhead.
          Analyze range does the same across your IN/OUT marks.
        </div>
        <div v-else>
          <div class="eb-muted" style="font-size:11.5px; margin-bottom:8px">
            {{ s.stack.length }} plate{{ s.stack.length === 1 ? '' : 's' }} at
            <span class="eb-mono">{{ s.stackTC }}</span>.
            Avid can only export one video track at a time, so each plate is grabbed in its own pass.
          </div>
          <!-- Naming lives with the names it changes: the plate rows below
               update live as these are typed. -->
          <div class="name-affix">
            <input v-model="s.prefix" class="eb-input" placeholder="prefix" aria-label="Plate name prefix" />
            <span class="eb-muted eb-mono" style="font-size:11.5px; white-space:nowrap">shot name</span>
            <input v-model="s.suffix" class="eb-input" placeholder="suffix" aria-label="Plate name suffix" />
          </div>
          <div class="plates">
            <div v-for="p in s.stack" :key="p.track" class="plate" :class="{ 'is-done': isGrabbed(p.track), 'is-next': nextTrack === p.track }">
              <div class="plate-l">
                <span class="plate-track eb-mono">V{{ p.track }}</span>
                <div>
                  <div class="plate-name eb-mono" :class="{ 'is-preview': !isGrabbed(p.track) }">
                    {{ displayName(p.track) }}
                  </div>
                  <div class="eb-muted" style="font-size:11px">
                    {{ p.clipName }} · {{ p.recIn }}–{{ p.recOut }}
                  </div>
                </div>
              </div>
              <span v-if="isGrabbed(p.track)" class="plate-done">
                <span class="eb-stat"><b>grabbed ✓</b></span>
                <button
                  class="eb-btn eb-btn--ghost eb-btn--mini"
                  title="Drop this plate so it can be grabbed again — use it if you deleted the subclip in Avid"
                  @click="ungrab(p.track)"
                >Re-grab</button>
              </span>
              <button
                v-else-if="nextTrack === p.track"
                class="eb-btn eb-btn--primary eb-btn--mini"
                :disabled="s.grabbingTrack !== null"
                @click="doGrab(p.track)"
              >{{ s.grabbingTrack === p.track ? 'Grabbing…' : 'Grab V' + p.track }}</button>
              <span v-else class="eb-muted" style="font-size:11px">waiting</span>
            </div>
          </div>
          <div v-if="nextTrack !== null" class="eb-callout" style="margin-top:10px">
            <template v-if="s.autoGrab">
              In the timeline, enable <b>only V{{ nextTrack }}</b><span v-if="otherTracks.length">
              (turn off {{ otherTracks.map(t => 'V' + t).join(', ') }})</span> — the panel grabs it
              the moment it sees it, so you can stay in Avid and work down the stack.
              {{ autoGrabStatus }}
            </template>
            <template v-else>
              Enable <b>only V{{ nextTrack }}</b><span v-if="otherTracks.length">
              (turn off {{ otherTracks.map(t => 'V' + t).join(', ') }})</span>, then click
              Grab V{{ nextTrack }}. Turn on Auto-grab to skip coming back to the panel each time.
              Either way, a grab that would flatten is refused.
            </template>
          </div>
          <div v-else class="eb-callout" style="margin-top:10px">
            All {{ s.grabbed.length }} plate{{ s.grabbed.length === 1 ? '' : 's' }} grabbed — Send builds the layered comp.
          </div>
        </div>
      </div>

      <div class="eb-actions">
        <button class="eb-btn eb-btn--primary eb-btn--wide" :disabled="s.sending || !canSend" @click="doSend">
          {{ s.sending ? 'Sending…' : sendLabel }}
        </button>
        <span class="eb-muted">{{ s.message }}</span>
      </div>

      <!-- Set-once preferences. Collapsed by default: these are project or
           facility defaults, not per-shot decisions. -->
      <div class="eb-section">
        <div class="eb-section-head">
          <button class="log-toggle" :aria-expanded="String(s.settingsOpen)" @click="s.settingsOpen = !s.settingsOpen">
            <span class="log-caret" :class="{ 'is-open': s.settingsOpen }">›</span>
            <h3 class="eb-section-title" style="margin:0">Settings</h3>
            <span class="eb-muted" style="font-size:11px">{{ settingsSummary }}</span>
          </button>
        </div>
        <div v-if="s.settingsOpen">
          <div class="eb-grid cols-2">
            <!-- Template picker is hidden while __blank__ is the only option;
                 s.templateId still flows to /send. It reappears if real
                 templates ever land in template_root. -->
            <div v-if="s.templates.length > 1" class="eb-field">
              <label class="eb-label">Template</label>
              <select v-model="s.templateId" class="eb-select">
                <option v-for="t in s.templates" :key="t.id" :value="t.id">{{ t.label }}</option>
              </select>
            </div>
            <div class="eb-field">
              <label class="eb-label">Handles</label>
              <input v-model.number="s.handles" type="number" min="0" max="120" class="eb-input" />
            </div>
          </div>

          <div v-if="s.inAvid" class="eb-field">
            <label class="eb-label">Export setting (QuickTime)</label>
            <select v-model="s.exportSetting" class="eb-select">
              <option value="">(default / current)</option>
              <option v-for="name in s.exportSettings" :key="name" :value="name">{{ name }}</option>
            </select>
          </div>

          <div class="eb-field">
            <label class="eb-label">Project mode</label>
            <div class="eb-tabs">
              <button
                class="eb-tab"
                :class="{ active: s.projectMode === 'new_per_shot' }"
                @click="setMode('new_per_shot')"
              >New project per shot</button>
              <button
                class="eb-tab"
                :class="{ active: s.projectMode === 'existing_project' }"
                @click="setMode('existing_project')"
              >Add to a project…</button>
            </div>
          </div>

          <div class="eb-actions">
            <button class="eb-btn eb-btn--ghost eb-btn--mini" :disabled="picking" @click="choose">
              {{ picking ? 'Choosing…' : (s.projectMode === 'new_per_shot' ? 'Name / place new project…' : 'Choose .aep…') }}
            </button>
            <span class="eb-mono eb-muted">{{ s.projectLabel || (s.projectMode === 'new_per_shot' ? 'auto (default location)' : 'no project chosen') }}</span>
          </div>
        </div>
      </div>

      <div class="eb-section">
        <div class="eb-section-head">
          <h3 class="eb-section-title">Shots</h3>
          <span v-if="pendingRenders.length" class="eb-chip is-on">{{ pendingRenders.length }} to import</span>
          <div class="eb-actions">
            <button class="eb-btn eb-btn--ghost eb-btn--mini" :disabled="loadingRenders" @click="refreshRenders(false)">
              {{ loadingRenders ? 'Reading…' : 'Rescan renders' }}
            </button>
            <button
              v-if="s.jobs.length"
              class="eb-btn eb-btn--ghost eb-btn--mini"
              @click="doClearJobs"
            >Clear finished</button>
          </div>
        </div>

        <div v-if="rendersError" class="eb-callout c-bad" style="font-size:11.5px">
          {{ rendersError }}
          <div v-if="!helperHasRenders" class="eb-mono" style="margin-top:6px">
            PYTHONPATH=. python -m service.app
          </div>
        </div>

        <div v-if="!shots.length" class="eb-muted">
          Nothing sent yet. Grab a shot's plates and Send to start one.
        </div>
        <div v-else class="jobs">
          <div v-for="sh in shots" :key="sh.key" class="shot-group">
            <div class="job" :class="{ 'is-orphan': sh.platesMissing.length }">
              <div style="min-width:0">
                <div class="job-name-row">
                  <!-- Multiple versions collapse behind a caret; a single
                       version needs no disclosure at all. -->
                  <button
                    v-if="sh.versions.length > 1"
                    class="ver-caret"
                    :class="{ 'is-open': isShotOpen(sh.key) }"
                    :aria-expanded="String(isShotOpen(sh.key))"
                    :aria-label="'Show versions of ' + sh.name"
                    @click="toggleShot(sh.key)"
                  >›</button>
                  <span class="eb-mono job-name">{{ sh.name }}</span>
                </div>
                <div class="job-state">
                  {{ sh.status }}
                  <span v-if="sh.versions.length > 1">
                    · {{ sh.versions.length }} versions<span v-if="sh.pendingCount">, {{ sh.pendingCount }} to import</span>
                  </span>
                </div>
                <div v-if="sh.platesMissing.length" class="c-bad" style="font-size:11px">
                  plate deleted: {{ sh.platesMissing.join(', ') }}
                </div>
              </div>

              <button
                v-if="sh.platesMissing.length"
                class="eb-btn eb-btn--ghost eb-btn--mini"
                title="The plate is gone from the plates folder, so this can never be re-rendered"
                @click="doRemoveJob(sh.job)"
              >Remove</button>
              <button
                v-else-if="sh.pendingCount > 1"
                class="eb-btn eb-btn--primary eb-btn--mini"
                :disabled="importingRender !== null"
                title="Import every version of this shot that isn't in the bin yet"
                @click="doImportAll(sh)"
              >Import all {{ sh.pendingCount }}</button>
              <button
                v-else-if="sh.pending"
                class="eb-btn eb-btn--primary eb-btn--mini"
                :disabled="importingRender === sh.pending.path"
                @click="doImportRender(sh.pending)"
              >{{ importingRender === sh.pending.path ? 'Importing…' : 'Import' }}</button>
              <button
                v-else-if="sh.job && sh.job.state === 'returned'"
                class="eb-btn eb-btn--primary eb-btn--mini"
                :disabled="importingId === sh.job.job_id"
                @click="doImport(sh.job)"
              >{{ importingId === sh.job.job_id ? 'Importing…' : 'Import' }}</button>
              <span v-else-if="sh.rendering" class="eb-stat"><b>rendering…</b></span>
              <span v-else-if="sh.imported" class="eb-stat"><b>in bin</b></span>
              <span v-else class="eb-stat"><b>in After Effects</b></span>
            </div>

            <div v-if="sh.versions.length > 1 && isShotOpen(sh.key)" class="versions">
              <div v-for="v in sh.versions" :key="v.path" class="version">
                <div style="min-width:0">
                  <div class="eb-mono" style="font-size:12px; overflow-wrap:anywhere">{{ v.name }}</div>
                  <div class="eb-muted" style="font-size:11px">
                    <span v-if="v.writing">rendering…</span>
                    <span v-else>{{ formatSize(v.size) }}</span>
                  </div>
                </div>
                <span v-if="v.imported" class="eb-stat"><b>in bin</b></span>
                <span v-else-if="v.writing" class="eb-muted" style="font-size:11px">wait</span>
                <button
                  v-else
                  class="eb-btn eb-btn--ghost eb-btn--mini"
                  :disabled="importingRender === v.path"
                  @click="doImportRender(v)"
                >{{ importingRender === v.path ? 'Importing…' : 'Import' }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="eb-section">
        <div class="eb-section-head">
          <button class="log-toggle" :aria-expanded="String(s.logOpen)" @click="s.logOpen = !s.logOpen">
            <span class="log-caret" :class="{ 'is-open': s.logOpen }">›</span>
            <h3 class="eb-section-title" style="margin:0">Diagnostics</h3>
            <span v-if="logEntries.length" class="eb-muted" style="font-size:11px">{{ logEntries.length }}</span>
            <span v-if="!s.logOpen && logErrorCount" class="c-bad" style="font-size:11px">· {{ logErrorCount }} error{{ logErrorCount === 1 ? '' : 's' }}</span>
          </button>
          <div class="eb-actions">
            <button
              v-if="s.inAvid"
              class="eb-btn eb-btn--ghost eb-btn--mini"
              :disabled="probing"
              title="Test whether this panel may drive Avid commands (needs the avid.mediacomposer.command scope)"
              @click="doProbeCommands"
            >{{ probing ? 'Probing…' : 'Probe commands' }}</button>
            <!-- Parked experiment: driving the track selectors via DoCommand.
                 Avid accepts the command but the enable state never moves. Kept
                 here (not in the grab flow) so it can be retested cheaply. -->
            <button
              v-if="s.inAvid && s.stack.length && nextTrack !== null"
              class="eb-btn eb-btn--ghost eb-btn--mini"
              :disabled="grabbingAll || s.grabbingTrack !== null"
              title="Experimental: have Avid solo each track itself. Known not to work — logs a full before/after diagnosis."
              @click="doGrabAll"
            >{{ grabbingAll ? 'Trying…' : 'Try auto-solo' }}</button>
            <button class="eb-btn eb-btn--ghost eb-btn--mini" @click="copyLog">{{ copied ? 'Copied ✓' : 'Copy' }}</button>
            <button class="eb-btn eb-btn--ghost eb-btn--mini" @click="clearLog">Clear</button>
          </div>
        </div>
        <div v-if="!s.logOpen" class="eb-muted" style="font-size:11.5px">
          Build {{ uiBuild }} · open when something needs diagnosing.
        </div>
        <!-- These are SEPARATE v-ifs, not one chain. Inserting this actions row
             as a `v-else` previously swallowed the open case and left the
             console below it unreachable — the log rendered nothing at all. -->
        <template v-if="s.logOpen">
          <div class="eb-actions" style="margin-bottom:8px">
            <label class="eb-chip" :class="{ 'is-on': s.pollPaused }" title="Stop the panel polling Media Composer for the playhead position">
              <input v-model="s.pollPaused" type="checkbox" style="margin-right:6px"> Pause updates
            </label>
          </div>
          <div v-if="!logEntries.length" class="eb-muted">No log yet.</div>
          <div v-else class="eb-console" ref="logbox">
            <div v-for="(e, i) in logEntries" :key="i">
              <span class="c-dim">{{ e.t }}</span>
              <span :class="e.kind === 'error' ? 'c-bad' : 'c-accent'">{{ e.label }}</span>
              <span v-if="e.detail"> {{ e.detail }}</span>
            </div>
          </div>
        </template>
        <textarea ref="logcopy" class="eb-hidden-copy" :value="logText" readonly aria-hidden="true"></textarea>
      </div>
    </div>
  </div>
</template>

<script>
import { aebridge as state } from '~/store/toolState'
import * as api from '~/utils/api/aebridge'
import * as tl from '~/utils/api/timeline'
import { getMcapiLog, clearMcapiLog, logMcapiVerbose } from '~/utils/api/mcapi'

// Bump this on every UI change so you can tell at a glance which build is loaded
// (shown as a pill in the header + printed to the log on load).
const UI_BUILD = '2026-07-29.20 · AE colour scheme'

// Shot polling. Every tick is 3 MCAPI calls into Media Composer, so we run
// fast only while something is actually happening.
const POLL_FAST_MS = 1500
const POLL_SLOW_MS = 6000
const IDLE_TICKS_BEFORE_SLOW = 8 // ~12s unchanged -> back off

// Cheap change-detector for polled lists. Polling every few seconds and
// assigning a brand-new array each time makes Vue tear down and rebuild every
// row — visible as a flicker. Compare first, assign only on a real change.
function sig(list) {
  try {
    return JSON.stringify(list)
  } catch (e) {
    return String(Math.random()) // unserializable: treat as changed
  }
}

export default {
  name: 'AEBridgePanel',
  data() {
    return { s: state, uiBuild: UI_BUILD, picking: false, reading: false, importingId: null, logEntries: [], copied: false, autoGrabStatus: '', probing: false, loadingRenders: false, importingRender: null, rendersError: '', grabbingAll: false, openShots: {}, _timer: null, _shotTimer: null, _logTimer: null, _onVis: null, _idleTicks: 0, _slowSkip: 0 }
  },
  computed: {
    logText() {
      return this.logEntries.map((e) => `${e.t} ${e.label}${e.detail ? ' ' + e.detail : ''}`).join('\n')
    },
    // Shown on the collapsed header so a failure is still visible without
    // having to open the log.
    logErrorCount() {
      return this.logEntries.filter((e) => e.kind === 'error').length
    },
    pendingRenders() {
      return (this.s.renders || []).filter((r) => !r.imported && !r.writing)
    },
    // Jobs and render files are two views of the same thing, and the editor
    // thinks in shots — so merge them into one list keyed by shot name, with
    // every render of that shot as a version. A second render out of the same
    // comp becomes "another version of a shot you recognise" rather than an
    // orphan file in a separate list.
    shots() {
      const byKey = {}
      const keyFor = (name) => String(name || '').trim() || '(unnamed)'

      for (const j of this.s.jobs || []) {
        // shot_name arrives from the helper; fall back to the job id so an
        // older helper still groups sanely rather than collapsing everything.
        const name = j.shot_name || j.job_id
        const k = keyFor(name)
        byKey[k] = byKey[k] || { key: k, name, job: null, versions: [], platesMissing: [] }
        byKey[k].job = j
        byKey[k].platesMissing = j.plates_missing || []
      }

      for (const r of this.s.renders || []) {
        const job = (this.s.jobs || []).find((j) => j.job_id === r.job_id)
        const name = (job && (job.shot_name || job.job_id)) || r.name.replace(/\.[^.]+$/, '')
        const k = keyFor(name)
        byKey[k] = byKey[k] || { key: k, name, job: job || null, versions: [], platesMissing: [] }
        byKey[k].versions.push(r)
      }

      return Object.values(byKey).map((sh) => {
        sh.versions.sort((a, b) => (b.modified || 0) - (a.modified || 0))
        sh.rendering = sh.versions.some((v) => v.writing)
        // Newest un-imported, settled render is what Import acts on.
        const importable = sh.versions.filter((v) => !v.imported && !v.writing)
        sh.pending = importable[0] || null // newest first
        sh.pendingCount = importable.length
        sh.imported = sh.versions.length > 0 && sh.versions.every((v) => v.imported)
        sh.status = sh.platesMissing.length
          ? 'plate missing'
          : sh.pending
            ? 'render ready'
            : sh.rendering
              ? 'rendering'
              : sh.imported
                ? 'in bin'
                : sh.job
                  ? this.stateLabel(sh.job.state)
                  : 'render'
        return sh
      })
    },
    rangeReadyCount() {
      if (!this.s.range) return 0
      return this.s.range.shots.filter((sh) => (sh.grabbed || []).length && sh.shotMeta).length
    },
    settingsSummary() {
      const bits = [this.s.handles + 'f handles']
      bits.push(this.s.projectMode === 'existing_project' ? 'shared project' : 'project per shot')
      if (this.s.exportSetting) bits.push(this.s.exportSetting)
      return bits.join(' · ')
    },
    // Renders/reset routes landed in helper 0.0.2. The helper does not
    // hot-reload, so this is routinely false until the user restarts it.
    helperHasRenders() {
      return (this.s.helperFeatures || []).includes('aebridge.renders')
    },
    // Lowest track not yet grabbed — grabbed bottom-up so V1's marker names the stack.
    nextTrack() {
      const pending = this.s.stack.filter((p) => !this.isGrabbed(p.track))
      return pending.length ? pending[0].track : null
    },
    // Tracks the user must turn OFF for the next pass (any other track in the stack).
    otherTracks() {
      return this.s.stack.filter((p) => p.track !== this.nextTrack).map((p) => p.track)
    },
    canSend() {
      return !this.s.inAvid || this.s.grabbed.length > 0
    },
    sendLabel() {
      if (!this.s.inAvid) return 'Send to After Effects'
      const n = this.s.grabbed.length
      if (!n) return 'Grab a plate first'
      return 'Send ' + n + ' plate' + (n === 1 ? '' : 's') + ' to After Effects'
    }
  },
  async mounted() {
    logMcapiVerbose('UI build', { build: UI_BUILD })
    this.restorePrefs()
    this.s.inAvid = tl.mcapiAvailable()
    await this.refreshVersion()
    await this.refreshTemplates()
    await this.refreshJobs()
    if (this.s.inAvid) {
      this.loadExportSettings()
      this.readShot()
      // Auto-refresh the current shot readout (MCAPI has no push events, so
      // polling is the only option). Every tick costs Media Composer 3 RPCs,
      // so it backs off when idle and stops entirely when the panel is hidden
      // — see shotPollTick.
      this._shotTimer = setInterval(this.shotPollTick, POLL_FAST_MS)
    }
    if (this.s.inAvid) this.refreshRenders()
    this._timer = setInterval(() => {
      this.refreshJobs()
      // Renders are files, not MCAPI — polling them costs Avid nothing, and
      // it's how a second version of a comp gets noticed.
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
        this.refreshRenders(true) // quiet: don't stomp on s.message from a poll
      }
    }, 4000)
    this._logTimer = setInterval(() => { this.logEntries = getMcapiLog() }, 1000)
    // Avid's WebView keeps running when the panel is behind other windows;
    // there is no reason to keep interrogating MC then.
    this._onVis = () => {
      if (document.visibilityState === 'visible') this.wakePolling()
    }
    document.addEventListener('visibilitychange', this._onVis)
  },
  beforeDestroy() {
    if (this._timer) clearInterval(this._timer)
    if (this._shotTimer) clearInterval(this._shotTimer)
    if (this._logTimer) clearInterval(this._logTimer)
    if (this._onVis) document.removeEventListener('visibilitychange', this._onVis)
  },
  watch: {
    's.exportSetting'(v) { this.savePref('exportSetting', v) },
    's.prefix'(v) { this.savePref('prefix', v) },
    's.suffix'(v) { this.savePref('suffix', v) },
    's.projectMode'(v) { this.savePref('projectMode', v) },
    's.logOpen'(v) { this.savePref('logOpen.v2', v ? '1' : '0') },
    's.settingsOpen'(v) { this.savePref('settingsOpen', v ? '1' : '0') },
    's.pollPaused'(v) { this.savePref('pollPaused', v ? '1' : '0'); if (!v) this.wakePolling() },
    // Turning auto-grab on must restore a responsive poll, or it could sit in
    // the slow lane and take seconds to notice a soloed track.
    's.autoGrab'(v) { this.savePref('autoGrab', v ? '1' : '0'); if (v) this.wakePolling() }
  },
  methods: {
    savePref(k, v) {
      try { window.localStorage.setItem('aebridge.' + k, v == null ? '' : String(v)) } catch (e) {}
    },
    restorePrefs() {
      try {
        const g = (k) => window.localStorage.getItem('aebridge.' + k)
        if (g('exportSetting') != null) this.s.exportSetting = g('exportSetting')
        if (g('prefix') != null) this.s.prefix = g('prefix')
        if (g('suffix') != null) this.s.suffix = g('suffix')
        if (g('projectMode')) this.s.projectMode = g('projectMode')
        if (g('projectPath') != null) this.s.projectPath = g('projectPath')
        if (g('projectLabel') != null) this.s.projectLabel = g('projectLabel')
        // v2 key: the old one may hold a stale "collapsed" from when the log
        // defaulted shut, which would override the new default.
        if (g('logOpen.v2') != null) this.s.logOpen = g('logOpen.v2') === '1'
        if (g('settingsOpen') != null) this.s.settingsOpen = g('settingsOpen') === '1'
        if (g('autoGrab') != null) this.s.autoGrab = g('autoGrab') === '1'
        if (g('pollPaused') != null) this.s.pollPaused = g('pollPaused') === '1'
      } catch (e) {}
    },
    stateLabel(x) {
      return (x || '').replace(/_/g, ' ')
    },
    async refreshVersion() {
      try {
        const v = await api.getVersion()
        this.s.helper = { online: true, version: v.helper_version }
        this.s.ae = { found: !!v.ae_version, version: v.ae_version }
        this.s.helperFeatures = v.feature_ids || []
      } catch (e) {
        this.s.helper = { online: false, version: null }
        this.s.helperFeatures = []
      }
    },
    async refreshTemplates() {
      try {
        this.s.templates = await api.listTemplates()
        if (!this.s.templates.find((t) => t.id === this.s.templateId)) {
          this.s.templateId = this.s.templates.length ? this.s.templates[0].id : '__blank__'
        }
      } catch (e) {
        this.s.templates = [{ id: '__blank__', label: 'Blank comp (no template)' }]
      }
    },
    async refreshJobs() {
      try {
        const jobs = await api.listJobs()
        // Only reassign when something actually changed — a fresh array every
        // 4s makes Vue re-render every row, which reads as a flicker.
        const next = jobs.slice().reverse()
        if (sig(next) !== sig(this.s.jobs)) this.s.jobs = next
      } catch (e) {
        /* leave prior list */
      }
    },
    async loadExportSettings() {
      try {
        this.s.exportSettings = await tl.getExportSettings()
      } catch (e) {
        this.s.exportSettings = []
      }
    },
    // One poll tick. Skips entirely when the panel is hidden or paused, and
    // backs off to POLL_SLOW_MS once the shot has been unchanged for a while,
    // so an idle panel is not hammering Media Composer in the background.
    async shotPollTick() {
      if (!this.s.inAvid || this.s.pollPaused) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (this.grabbingAll) return // don't compete with the track-command sequence
      // Auto-grab needs a responsive poll; so does an in-flight operation.
      const busy = this.s.autoGrab || this.s.grabbingTrack !== null || this.s.sending
      if (!busy && this._idleTicks >= IDLE_TICKS_BEFORE_SLOW) {
        this._slowSkip = (this._slowSkip || 0) + 1
        if (this._slowSkip < Math.round(POLL_SLOW_MS / POLL_FAST_MS)) return
      }
      this._slowSkip = 0
      const beforeTC = this.s.shot && this.s.shot.playheadTC
      await this.readShot(true)
      const afterTC = this.s.shot && this.s.shot.playheadTC
      if (afterTC && afterTC === beforeTC) this._idleTicks += 1
      else this._idleTicks = 0
    },
    // Something happened (panel refocused, user acted) — poll at full rate again.
    wakePolling() {
      this._idleTicks = 0
      this._slowSkip = 0
    },
    async readShot(quiet = false) {
      if (!this.s.inAvid) return
      if (this._readInFlight) return // avoid overlapping polls
      this._readInFlight = true
      if (!quiet) this.reading = true
      try {
        this.s.shot = await tl.getCurrentShot()
        if (quiet) this.s.shotMessage = ''
      } catch (e) {
        if (!quiet) {
          this.s.shot = null
          this.s.shotMessage = 'Could not read shot: ' + e.message
        }
      } finally {
        this.reading = false
        this._readInFlight = false
      }
      await this.maybeAutoGrab()
    },
    // Does this panel get to drive Avid commands? Answers whether the manual
    // track toggling can be automated away. Everything lands in the log.
    async doProbeCommands() {
      this.probing = true
      this.s.message = 'Probing Avid commands…'
      try {
        const r = await tl.probeCommands()
        this.s.message = 'Commands available: ' + r.commands.length +
          ' (' + r.trackRelated.length + ' track-related) — see the Log.'
      } catch (e) {
        this.s.message = 'Command probe failed: ' + e.message +
          (/code=7/.test(e.message)
            ? ' — still denied even with the command scope declared. Confirm the rebuilt .avpi is installed and Media Composer was restarted.'
            : '')
      } finally {
        this.probing = false
      }
    },
    // --- plate stack ---
    // Auto-grab: watch the timeline's track enable state and grab a plate the
    // moment its track is soloed. Avid gives us no way to SET the enable state,
    // so the toggling stays manual — but this removes the trip back to the
    // panel between passes, which is the actual friction.
    async maybeAutoGrab() {
      if (!this.s.autoGrab || !this.s.inAvid) return
      if (!this.s.stack.length || this.nextTrack === null) return
      // Never race a grab/send/analyze already in flight.
      if (this.s.grabbingTrack !== null || this.s.sending || this.s.analyzing) return
      if (!this.s.shot || !this.s.shot.mobId) return
      let tracks
      try {
        tracks = await tl.getMobTrackInfo(this.s.shot.mobId)
      } catch (e) {
        return
      }
      // Which tracks OF THIS STACK are enabled? Tracks outside the stack carry
      // no picture over this shot, so they cannot flatten it and are ignored.
      const inStack = (n) => this.s.stack.some((p) => p.track === n)
      const enabled = tl.enabledVideoTracks(tracks).filter((t) => inStack(t.number)).map((t) => t.number)
      if (enabled.length !== 1) {
        this.autoGrabStatus = enabled.length
          ? 'Waiting — V' + enabled.join(', V') + ' enabled; solo exactly one.'
          : 'Waiting — no stack track enabled.'
        return
      }
      const solo = enabled[0]
      if (this.isGrabbed(solo)) {
        this.autoGrabStatus = 'V' + solo + ' already grabbed — solo V' + this.nextTrack + ' next.'
        return
      }
      // V1 must go first: its marker names the whole stack.
      if (!this.s.baseName && solo !== 1) {
        this.autoGrabStatus = 'Solo V1 first — it names the stack.'
        return
      }
      this.autoGrabStatus = ''
      await this.doGrab(solo)
    },
    isGrabbed(track) {
      return this.s.grabbed.some((g) => g.track === track)
    },
    // The name the plate FILE will actually carry — the prefix/suffix are part
    // of it, so the list must show them or it misreports what Send will write.
    withAffixes(raw) {
      return raw ? (this.s.prefix || '') + raw + (this.s.suffix || '') : ''
    },
    displayName(track) {
      const g = this.s.grabbed.find((x) => x.track === track)
      if (g) return this.withAffixes(g.name)
      // Not grabbed yet — a preview. Each track prefers its own marker, which
      // can only be read at grab time, so upper tracks show the fallback form.
      if (track === 1) return this.s.baseName ? this.withAffixes(this.s.baseName) : 'from V1 marker'
      const base = this.s.baseName || '<shot>'
      return 'own marker, else ' + this.withAffixes(base + '_pl' + String(track).padStart(2, '0'))
    },
    resetStack() {
      this.s.stack = []
      this.s.grabbed = []
      this.s.baseName = ''
      this.s.stackShot = null
      this.s.stackTC = ''
      this.s.message = ''
    },
    // Drop one grabbed plate so it can be grabbed again. The Avid subclip is
    // NOT deleted (no delete API) — this only forgets it here, which is what
    // you want after deleting the subclip by hand.
    ungrab(track) {
      this.s.grabbed = this.s.grabbed.filter((g) => g.track !== track)
      // V1 names the stack, so dropping it invalidates the inherited names.
      if (track === 1) {
        this.s.baseName = ''
        this.s.stackShot = null
        this.s.grabbed = []
        this.s.message = 'Dropped V1 — the whole stack must be re-grabbed (V1 names it).'
      } else {
        this.s.message = 'Dropped V' + track + ' — grab it again.'
      }
    },
    async doAnalyze() {
      this.s.analyzing = true
      this.s.message = 'Reading each video track…'
      try {
        const r = await tl.analyzeStack({
          parseEdl: (edlPath) => api.parseEdl(edlPath).then((x) => x.clips)
        })
        const samePlayhead = r.shot.playheadTC === this.s.stackTC
        if (!samePlayhead) {
          // A new playhead position invalidates anything already grabbed.
          this.s.grabbed = []
          this.s.baseName = ''
          this.s.stackShot = null
          this.s.stack = r.stack
        } else {
          // Same shot, re-scanned: UNION with the existing plan. Mid-stack the
          // user has tracks disabled, and it is not established that ExportEDL
          // reports a disabled track — without this merge a re-Analyze could
          // silently drop plates that are still to be grabbed.
          const byTrack = {}
          for (const p of this.s.stack) byTrack[p.track] = p
          for (const p of r.stack) byTrack[p.track] = p
          this.s.stack = Object.values(byTrack).sort((a, b) => a.track - b.track)
        }
        this.s.stackTC = r.shot.playheadTC
        this.s.message = this.s.stack.length
          ? this.s.stack.length + ' plate(s): ' + this.s.stack.map((p) => 'V' + p.track).join(', ')
          : 'No picture under the playhead — park on a shot and Analyze again.'
      } catch (e) {
        this.s.message = 'Analyze error: ' + e.message
      } finally {
        this.s.analyzing = false
      }
    },
    // Grab every plate in one go: solo each track via Avid commands, grab it,
    // then put the timeline's enable state back. No manual toggling.
    async doGrabAll() {
      if (!this.s.stack.length) return
      const seq = this.s.shot && this.s.shot.mobId
      if (!seq) { this.s.message = 'No sequence — refresh the shot first.'; return }
      const stackTracks = this.s.stack.map((p) => p.track)
      // Remember the editor's own enable state so we can restore it.
      const desired = {}
      try {
        for (const t of await tl.getMobTrackInfo(seq)) {
          if (stackTracks.includes(t.number)) desired[t.number] = !!t.enabled
        }
      } catch (e) { /* restore is best-effort */ }

      this.s.autoGrab = false // the two would race each other
      // Avid runs one command at a time; keep the shot poll out of the way
      // while we drive the track selectors.
      this.grabbingAll = true
      try {
        for (const p of this.s.stack) {
          if (this.isGrabbed(p.track)) continue
          this.s.message = 'Soloing V' + p.track + '…'
          await tl.soloVideoTrack({ sequenceMobId: seq, trackNumber: p.track, stackTracks })
          await this.doGrab(p.track)
          // doGrab swallows its error into s.message; stop rather than pile up.
          if (!this.isGrabbed(p.track)) {
            this.s.message = 'Stopped at V' + p.track + ' — ' + this.s.message
            break
          }
        }
      } catch (e) {
        this.s.message = 'Auto-solo failed: ' + e.message
      } finally {
        try {
          await tl.restoreTrackEnableState({ sequenceMobId: seq, desired })
        } catch (e) {
          this.s.message += ' (track enable state left as-is — check the timeline)'
        }
        this.grabbingAll = false
      }
    },
    // Read the sequence's IN/OUT marks and enumerate every shot in the range.
    async doAnalyzeRange() {
      this.s.rangeAnalyzing = true
      this.s.message = 'Reading the marked range…'
      try {
        const r = await tl.analyzeRange({
          parseEdl: (edlPath) => api.parseEdl(edlPath).then((x) => x.clips)
        })
        const totalPlates = r.shots.reduce((n, sh) => n + sh.stack.length, 0)
        this.s.range = {
          markIn: r.shot.markIn,
          markOut: r.shot.markOut,
          shots: r.shots,
          totalPlates,
        }
        this.s.message = r.shots.length + ' shot(s), ' + totalPlates + ' plate(s) in ' +
          r.shot.markIn + '–' + r.shot.markOut
      } catch (e) {
        this.s.range = null
        this.s.message = 'Range error: ' + e.message
      } finally {
        this.s.rangeAnalyzing = false
      }
    },
    // Tracks still to grab across the range, ascending. V1 first because each
    // shot's V1 marker names that shot's whole stack.
    rangeTracksRemaining() {
      if (!this.s.range) return []
      const out = []
      for (const sh of this.s.range.shots) {
        for (const p of sh.stack) {
          const already = (sh.grabbed || []).some((g) => g.track === p.track)
          if (!already && !out.includes(p.track)) out.push(p.track)
        }
      }
      return out.sort((a, b) => a - b)
    },
    // Grab ONE track's plate for EVERY shot in the range. This is the payoff of
    // the range design: soloing is per-track, not per-shot, so N shots × M
    // tracks costs only M manual solos.
    async doGrabTrackAcrossRange(track) {
      if (!this.s.range) return
      const todo = this.s.range.shots
        .map((sh, i) => ({ sh, i }))
        .filter(({ sh }) => sh.stack.some((p) => p.track === track) &&
          !(sh.grabbed || []).some((g) => g.track === track))
      if (!todo.length) return

      this.s.grabbingTrack = track
      let done = 0
      try {
        for (const { sh, i } of todo) {
          this.s.message = 'Grabbing V' + track + ' — shot ' + (i + 1) + '/' + this.s.range.shots.length + '…'
          // eslint-disable-next-line no-await-in-loop
          const grabbed = await tl.grabShot({
            destBinPath: this.s.destBin,
            handles: Number(this.s.handles) || 0,
            trackNumber: track,
            baseName: track === 1 ? '' : (sh.baseName || ''),
            atTC: sh.atTC,
            atFrame: sh.atFrame,
            parseEdl: (edlPath) => api.parseEdl(edlPath).then((x) => x.clips)
          }).catch((e) => { throw new Error('shot ' + (i + 1) + ' (' + sh.atTC + '): ' + e.message) })

          if (track === 1) {
            this.$set(sh, 'baseName', grabbed.shot.shot_name)
            this.$set(sh, 'shotMeta', grabbed.shot)
          }
          const kept = (sh.grabbed || []).filter((g) => g.track !== track)
          this.$set(sh, 'grabbed', kept.concat([grabbed.plate]).sort((a, b) => a.track - b.track))
          done += 1
        }
        const left = this.rangeTracksRemaining()
        this.s.message = 'Grabbed V' + track + ' for ' + done + ' shot' + (done === 1 ? '' : 's') +
          (left.length ? ' — next: solo V' + left[0] : ' — all plates grabbed, ready to Send')
      } catch (e) {
        this.s.message = 'Range grab stopped after ' + done + ' — ' + e.message
      } finally {
        this.s.grabbingTrack = null
      }
    },
    async doGrab(track) {
      this.s.grabbingTrack = track
      this.s.message = 'Grabbing V' + track + '…'
      try {
        const grabbed = await tl.grabShot({
          destBinPath: this.s.destBin,
          handles: Number(this.s.handles) || 0,
          trackNumber: track,
          baseName: track === 1 ? '' : this.s.baseName,
          parseEdl: (edlPath) => api.parseEdl(edlPath).then((r) => r.clips)
        })
        if (track === 1) {
          this.s.baseName = grabbed.shot.shot_name
          this.s.stackShot = grabbed.shot // V1 defines the comp's size/rate/duration
        }
        this.s.grabbed = this.s.grabbed
          .filter((g) => g.track !== track)
          .concat([grabbed.plate])
          .sort((a, b) => a.track - b.track)
        this.s.message = 'Grabbed ' + grabbed.plate.name +
          (this.nextTrack !== null ? ' — next: enable only V' + this.nextTrack : ' — ready to Send')
      } catch (e) {
        this.s.message = 'Grab error: ' + e.message
      } finally {
        this.s.grabbingTrack = null
      }
    },
    setMode(mode) {
      this.s.projectMode = mode
      this.s.projectToken = null
      // keep projectPath/label so a remembered project survives a mode toggle
    },
    async choose() {
      this.picking = true
      try {
        const r = this.s.projectMode === 'new_per_shot'
          ? await api.newProject()
          : await api.pickProject()
        this.s.projectToken = r.target_project_token
        this.s.projectLabel = r.label
        this.s.projectPath = r.path || ''
        this.savePref('projectPath', this.s.projectPath)
        this.savePref('projectLabel', this.s.projectLabel)
      } catch (e) {
        this.s.projectLabel = 'cancelled / unavailable'
      } finally {
        this.picking = false
      }
    },
    clearLog() {
      clearMcapiLog()
      this.logEntries = []
    },
    async copyLog() {
      const text = this.logText
      let ok = false
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text)
          ok = true
        }
      } catch (e) { /* fall through */ }
      if (!ok) {
        // Fallback for restricted WebViews: select the hidden textarea + execCommand.
        try {
          const ta = this.$refs.logcopy
          ta.style.display = 'block'
          ta.select()
          ok = document.execCommand('copy')
          ta.style.display = ''
        } catch (e) { /* ignore */ }
      }
      this.copied = ok
      setTimeout(() => { this.copied = false }, 1500)
    },
    async doClearJobs() {
      try {
        await api.clearJobs(false) // finished only
        await this.refreshJobs()
      } catch (e) {
        this.s.message = 'Clear error: ' + e.message
      }
    },
    // Escape hatch for a wedged queue: drop every job whatever its state. Files
    // on disk survive, so anything still wanted is re-importable from Renders.
    async doHardReset() {
      if (!this.helperHasRenders) {
        this.s.message = 'Restart the AEBridge helper first — the running one predates /reset.'
        return
      }
      const ok = window.confirm(
        'Hard reset the job queue?\n\n' +
        'Every job is dropped, whatever its state.\n\n' +
        'Nothing on disk is deleted, and renders you have already imported stay ' +
        'marked as imported — so nothing gets pulled into Avid twice.'
      )
      if (!ok) return
      try {
        const r = await api.hardReset()
        this.s.message = 'Hard reset — dropped ' + (r.removed || 0) + ' job(s).'
        await this.refreshJobs()
        await this.refreshRenders()
      } catch (e) {
        this.s.message = 'Reset error: ' + e.message
      }
    },
    // A job whose plate has been deleted can never be re-rendered — the only
    // sensible action left is to drop it.
    async doRemoveJob(job) {
      try {
        await api.cancelJob(job.job_id)
      } catch (e) { /* cancel may be refused by state; clear below regardless */ }
      try {
        await api.clearJobs(false)
        await this.refreshJobs()
        if (this.s.jobs.some((j) => j.job_id === job.job_id)) {
          this.s.message = 'Could not drop ' + job.job_id + ' — use Hard reset.'
        } else {
          this.s.message = 'Removed ' + job.job_id + ' (its plate was deleted).'
        }
      } catch (e) {
        this.s.message = 'Remove error: ' + e.message
      }
    },
    async refreshRenders(quiet = false) {
      if (!this.s.inAvid) return
      // The helper does NOT hot-reload, so a running instance is often older
      // than the panel. Feature-detect rather than firing a request that 404s.
      if (!this.helperHasRenders) {
        this.rendersError = 'Restart the AEBridge helper to enable this — the running one predates the Renders route.'
        return
      }
      // A background poll must be invisible: showing "Reading…" every 4s makes
      // the button flicker. Only a user-initiated Rescan shows progress.
      if (!quiet) this.loadingRenders = true
      try {
        const next = await api.listRenders()
        // Only reassign when the list actually changed, so Vue leaves the
        // existing rows alone instead of re-rendering them on every poll.
        if (sig(next) !== sig(this.s.renders)) this.s.renders = next
        this.rendersError = ''
      } catch (e) {
        // Never fail silently: a Rescan that does nothing with no explanation
        // is worse than an error.
        this.rendersError = 'Could not read the render folder: ' + e.message
        if (!quiet) this.s.message = this.rendersError
      } finally {
        if (!quiet) this.loadingRenders = false
      }
    },
    formatSize(n) {
      if (!n) return '0 B'
      const mb = n / (1024 * 1024)
      return mb >= 1 ? mb.toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'
    },
    isShotOpen(key) {
      return !!this.openShots[key]
    },
    toggleShot(key) {
      this.$set(this.openShots, key, !this.openShots[key])
    },
    // Import every version of a shot that isn't in the bin yet. Sequential —
    // each import is an MCAPI call and Avid is happier one at a time.
    async doImportAll(sh) {
      const todo = sh.versions.filter((v) => !v.imported && !v.writing)
      if (!todo.length) return
      let done = 0
      for (const v of todo) {
        this.s.message = 'Importing ' + v.name + ' (' + (done + 1) + '/' + todo.length + ')…'
        // eslint-disable-next-line no-await-in-loop
        const ok = await this.doImportRender(v, true)
        if (!ok) {
          this.s.message = 'Stopped after ' + done + ' of ' + todo.length + ' — ' + this.s.message
          return
        }
        done += 1
      }
      this.s.message = 'Imported ' + done + ' version' + (done === 1 ? '' : 's') + ' of ' + sh.name
    },
    // Import any render file, matched to a job or not. This is what makes a
    // second/third version out of one comp usable.
    // Returns true on success so doImportAll can stop on the first failure
    // instead of piling up errors.
    async doImportRender(r, quiet = false) {
      if (!this.s.inAvid) {
        this.s.message = 'Import needs Media Composer (MCAPI).'
        return false
      }
      this.importingRender = r.path
      const bin = this.s.destBin
      if (!quiet) this.s.message = 'Importing ' + r.name + ' into ' + bin + '…'
      try {
        await tl.importReturn({ filePath: r.path, destBinPath: bin })
        await api.markRenderImported(r.path)
        // If it belongs to a job, close that job out too.
        if (r.job_id) {
          try { await api.markImported(r.job_id, bin) } catch (e) { /* already closed */ }
        }
        if (!quiet) this.s.message = 'Imported ' + r.name + ' into ' + bin
        await this.refreshRenders(true)
        await this.refreshJobs()
        return true
      } catch (e) {
        this.s.message = 'Import error: ' + e.message
        return false
      } finally {
        this.importingRender = null
      }
    },
    // Send every shot in the marked range as its own job — same pipeline as a
    // single Send, run N times. Stops on the first failure so a half-sent batch
    // is obvious rather than silently partial.
    async doSendRange() {
      const ready = (this.s.range ? this.s.range.shots : [])
        .filter((sh) => (sh.grabbed || []).length && sh.shotMeta)
      if (!ready.length) {
        this.s.message = 'Nothing to send — grab V1 across the range first.'
        return
      }
      if (!(await this.ensureProjectToken())) return
      this.s.sending = true
      let sent = 0
      try {
        for (const sh of ready) {
          this.s.message = 'Sending ' + (sent + 1) + '/' + ready.length + ' (' + sh.baseName + ')…'
          // eslint-disable-next-line no-await-in-loop
          const job = await this.sendOneShot(sh.shotMeta, sh.grabbed)
          if (!job) return // sendOneShot set the message
          sent += 1
        }
        this.s.message = 'Sent ' + sent + ' job' + (sent === 1 ? '' : 's') + ' from the marked range.'
        this.s.range = null
        await this.refreshJobs()
      } catch (e) {
        this.s.message = 'Range send stopped after ' + sent + ' — ' + e.message
      } finally {
        this.s.sending = false
      }
    },
    // Tokens don't survive a helper restart, but the remembered PATH does —
    // re-register it for a fresh token so the last project sticks.
    async ensureProjectToken() {
      if (this.s.projectMode !== 'existing_project' || this.s.projectToken) return true
      if (this.s.projectPath) {
        try {
          const r = await api.pickProject(this.s.projectPath)
          this.s.projectToken = r.target_project_token
          this.s.projectLabel = r.label
          return true
        } catch (e) {
          this.s.message = 'Saved project not found (' + (this.s.projectLabel || this.s.projectPath) + ') — Choose .aep… again.'
          return false
        }
      }
      this.s.message = 'Choose a project first (Choose .aep…), or switch to New project per shot.'
      return false
    },
    // One shot: name it, warn on collisions, prepare, export each plate, send.
    // Returns the job on success, null on failure (message already set).
    async sendOneShot(shotMeta, grabbedPlates) {
      const shot = { ...shotMeta }
      const named = (this.s.prefix || '') + shot.shot_name + (this.s.suffix || '')
      shot.shot_name = named
      const plates = tl.plateOffsets(grabbedPlates, Math.round(parseFloat(shot.frame_rate) || 24))
        .map((p) => ({ ...p, name: (this.s.prefix || '') + p.name + (this.s.suffix || '') }))
      logMcapiVerbose('sending plates (final names)', {
        shot: named,
        plates: plates.map((p) => ({ track: 'V' + p.track, name: p.name, offset: p.offset_frames })),
      })
      try {
        const clashes = []
        for (const p of plates) {
          // eslint-disable-next-line no-await-in-loop
          const chk = await api.plateExists(p.name)
          if (chk.exists) clashes.push(...(chk.files || []))
        }
        if (clashes.length) {
          const ok = window.confirm(
            'These plate files already exist:\n\n' + clashes.join('\n') +
            '\n\nOverwrite them?\n(Cancel to add a name prefix/suffix, then Send again.)'
          )
          if (!ok) {
            this.s.message = 'Cancelled — add a prefix/suffix to rename, then Send again.'
            return null
          }
        }
      } catch (e) { /* if the check fails, proceed */ }

      const prep = await api.prepare(named)
      const exported = []
      for (let i = 0; i < plates.length; i += 1) {
        const p = plates[i]
        this.s.message = 'Exporting ' + named + ' plate ' + (i + 1) + '/' + plates.length + '…'
        // eslint-disable-next-line no-await-in-loop
        const file = await tl.exportShot({
          mobId: p.mobId, exportDir: prep.export_dir, fileName: p.name,
          exportSettingsName: this.s.exportSetting,
        })
        exported.push({ name: p.name, file, track: p.track, order: p.order, offset_frames: p.offset_frames || 0 })
      }
      return api.send({
        template_id: this.s.templateId,
        handles: Number(this.s.handles) || 0,
        project_mode: this.s.projectMode,
        target_project_token: this.s.projectToken || null,
        job_id: prep.job_id,
        shot,
        reference_path: exported.length ? exported[0].file : null,
        plates: exported,
      })
    },
    async doSend() {
      if (!(await this.ensureProjectToken())) return
      this.s.sending = true
      try {
        let job
        if (this.s.inAvid) {
          // Plates were collected by Grab (one pass per track). Same pipeline
          // the range send uses, so the two can't drift apart.
          job = await this.sendOneShot(this.s.stackShot, this.s.grabbed)
          if (!job) return // sendOneShot set the message
        } else {
          this.s.message = 'Sending (placeholder shot)…'
          job = await api.send({
            template_id: this.s.templateId,
            handles: Number(this.s.handles) || 0,
            project_mode: this.s.projectMode,
            target_project_token: this.s.projectToken || null,
          })
        }
        this.s.message = 'Sent — ' + job.job_id + ' (' + this.stateLabel(job.state) + ')'
        // Clear the collected stack so the next shot starts clean (the plates
        // are now the job's; re-sending them would duplicate the work).
        if (this.s.inAvid) this.resetStack()
        await this.refreshJobs()
      } catch (e) {
        this.s.message = 'Error: ' + e.message
      } finally {
        this.s.sending = false
      }
    },
    async doImport(job) {
      if (!this.s.inAvid) {
        this.s.message = 'Import needs Media Composer (MCAPI).'
        return
      }
      this.importingId = job.job_id
      // Return lands back in the same bin the shot was exported from; the editor
      // cuts it in manually (keeps the original plate + its extendability).
      const bin = this.s.destBin
      this.s.message = 'Importing render into ' + bin + '…'
      try {
        await tl.importReturn({ filePath: job.return_path, destBinPath: bin })
        await api.markImported(job.job_id, bin)
        this.s.message = 'Imported ' + job.job_id + ' into ' + bin
        await this.refreshJobs()
      } catch (e) {
        this.s.message = 'Import error: ' + e.message
      } finally {
        this.importingId = null
      }
    },
    async showAeDiag() {
      try {
        const d = await api.getAeStatus()
        const paths = d.searched && d.searched.length ? d.searched.join('\n') : '(none found)'
        window.alert(
          'After Effects not found.\n\nPlatform: ' +
            d.platform +
            '\n\nSearched:\n' +
            paths +
            "\n\nInstall After Effects, or tell me where it lives and I'll add that path."
        )
      } catch (e) {
        window.alert('Could not read AE diagnostics: ' + e.message)
      }
    }
  }
}
</script>

<style scoped>
.jobs { display: flex; flex-direction: column; gap: 8px; }
.job {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  background: var(--input-bg); border: 1px solid var(--line);
  border-radius: var(--r-ctrl); padding: 10px 12px;
}
.job-name { font-size: 12px; color: var(--ink-2); }
.job-state { font-family: var(--font-mono); font-size: 11px; color: var(--accent); }

.eb-console {
  background: #070d16; border: 1px solid var(--line); border-radius: var(--r-ctrl);
  font-family: var(--font-mono); font-size: 11.5px; line-height: 1.5;
  color: var(--ink-2); padding: 10px 12px; max-height: 260px; overflow: auto;
  white-space: pre-wrap; word-break: break-word;
}
.eb-console .c-dim { color: var(--muted-2); margin-right: 6px; }
.eb-console .c-accent { color: var(--accent); }
.eb-console .c-bad { color: var(--bad); }
.eb-hidden-copy { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }

.plates { display: flex; flex-direction: column-reverse; gap: 6px; }
.plate {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  background: var(--input-bg); border: 1px solid var(--line);
  border-radius: var(--r-ctrl); padding: 8px 12px;
}
.plate.is-next { border-color: var(--accent-line); background: var(--accent-soft); }
.plate.is-done { opacity: 0.75; }
.plate-l { display: flex; align-items: center; gap: 10px; min-width: 0; }
.plate-track {
  font-size: 11px; color: var(--muted-2); border: 1px solid var(--line);
  border-radius: 6px; padding: 2px 6px; flex: none;
}
.plate.is-next .plate-track { color: var(--accent); border-color: var(--accent-line); }
.plate-name { font-size: 12px; color: var(--ink-2); overflow-wrap: anywhere; }
.plate-name.is-preview { color: var(--muted); font-style: italic; }
.plate-done { display: flex; align-items: center; gap: 8px; }
.job.is-orphan { border-color: var(--bad); }
/* The shared head styles assume a three-line eyebrow/title/sub on the left and
   a stacked status column on the right. With only the app name on the left, a
   four-row pill stack made the two sides badly lopsided — so the status items
   run as a single wrapping row and both sides sit on one baseline. */
.eb-tool-head { align-items: center; }
.eb-tool-head-r {
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

/* App-name lockup. The shell's sidebar carries a wordmark too, but style.scss
   hides the sidebar at <=900px — which is where this panel usually sits when
   docked in Avid, leaving no app name on screen at all. So the head owns the
   name at every width and the sidebar's copy is suppressed (see style.scss),
   rather than one appearing only on wide layouts.

   .eb-brand is written for EB's sidebar (centred, padded, bottom border); in the
   head it has to be a bare left-aligned lockup. */
.eb-brand--inline {
  padding: 0;
  border-bottom: 0;
  text-align: left;
  margin: 0;
}
.eb-brand--inline .eb-brand-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.01em;
  color: var(--ink);
  /* Docked narrow, the name must never break across two lines. Pills wrap. */
  white-space: nowrap;
}

/* The shared head styles assume a three-line eyebrow/title/sub on the left and
   a stacked status column on the right. With just the name on the left, a
   four-row pill tower made the two sides badly lopsided — so the status items
   run as one wrapping row and both sides share a centre line. */
.eb-tool-head { align-items: center; }
.eb-tool-head-l { flex: none; }
.eb-tool-head-r {
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.name-affix { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.name-affix .eb-input { flex: 1; min-width: 0; }
.shot-group { display: flex; flex-direction: column; gap: 4px; }
.job-name-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ver-caret {
  background: none; border: 0; padding: 0; cursor: pointer; color: var(--muted-2);
  font-size: 15px; line-height: 1; transition: transform 0.12s ease; flex: none;
}
.ver-caret.is-open { transform: rotate(90deg); }
.versions { display: flex; flex-direction: column; gap: 4px; margin: 0 0 4px 18px; }
.range-shots { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
.range-shot {
  display: flex; align-items: center; gap: 10px;
  background: var(--input-bg); border: 1px solid var(--line);
  border-radius: var(--r-ctrl); padding: 6px 10px;
}
.version {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  background: var(--input-bg); border: 1px solid var(--line);
  border-radius: var(--r-ctrl); padding: 6px 10px;
}
.eb-chip.is-on { color: var(--accent); border-color: var(--accent-line); background: var(--accent-soft); }

.log-toggle {
  display: flex; align-items: center; gap: 8px;
  background: none; border: 0; padding: 0; cursor: pointer; color: inherit; font: inherit;
}
.log-caret {
  display: inline-block; color: var(--muted-2); font-size: 15px; line-height: 1;
  transition: transform 0.12s ease;
}
.log-caret.is-open { transform: rotate(90deg); }
</style>
