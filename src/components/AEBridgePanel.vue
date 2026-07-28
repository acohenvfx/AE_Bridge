<template>
  <div class="eb-tool">
    <div class="eb-tool-head">
      <div class="eb-tool-head-l">
        <div class="eb-tool-eyebrow">
          <span class="dot" aria-hidden="true"></span>
          BRIDGE · AVID ↔ AFTER EFFECTS
        </div>
        <h2 class="eb-tool-title">Round-trip a shot to After Effects</h2>
        <p class="eb-tool-sub">
          Send the selected shot out with the plate pre-loaded; get the render back and cut it in.
        </p>
      </div>
      <div class="eb-tool-head-r">
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
          <button class="eb-btn eb-btn--ghost eb-btn--mini" :disabled="reading" @click="readShot">
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
      </div>

      <div v-if="s.inAvid" class="eb-section">
        <div class="eb-section-head">
          <h3 class="eb-section-title">Plate stack</h3>
          <div class="eb-actions">
            <button class="eb-btn eb-btn--ghost eb-btn--mini" :disabled="s.analyzing" @click="doAnalyze">
              {{ s.analyzing ? 'Analyzing…' : 'Analyze stack' }}
            </button>
            <label v-if="s.stack.length" class="eb-chip" :class="{ 'is-on': s.autoGrab }" :title="'Grab each plate automatically as you solo its track in the Avid timeline'">
              <input v-model="s.autoGrab" type="checkbox" style="margin-right:6px"> Auto-grab
            </label>
            <button v-if="s.stack.length" class="eb-btn eb-btn--ghost eb-btn--mini" @click="resetStack">Reset</button>
          </div>
        </div>

        <div v-if="!s.stack.length" class="eb-muted">
          Analyze reads each video track's EDL to find every clip under the playhead.
        </div>
        <div v-else>
          <div class="eb-muted" style="font-size:11.5px; margin-bottom:8px">
            {{ s.stack.length }} plate{{ s.stack.length === 1 ? '' : 's' }} at
            <span class="eb-mono">{{ s.stackTC }}</span>.
            Avid can only export one video track at a time, so each plate is grabbed in its own pass.
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
              <span v-if="isGrabbed(p.track)" class="eb-stat"><b>grabbed ✓</b></span>
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
              Solo <b>V{{ nextTrack }}</b> in the Avid timeline
              <span v-if="otherTracks.length">(only V{{ nextTrack }} enabled)</span> —
              the panel grabs it as soon as it sees it, so you can stay in Avid and just
              work down the tracks. {{ autoGrabStatus }}
            </template>
            <template v-else>
              In the Avid timeline, enable <b>only V{{ nextTrack }}</b>
              <span v-if="otherTracks.length"> (turn off {{ otherTracks.map(t => 'V' + t).join(', ') }})</span>,
              then click Grab V{{ nextTrack }}. The panel checks the enable state and refuses if another
              track would flatten into the plate.
            </template>
          </div>
          <div v-else class="eb-callout" style="margin-top:10px">
            All {{ s.grabbed.length }} plate{{ s.grabbed.length === 1 ? '' : 's' }} grabbed — Send builds the layered comp.
          </div>
        </div>
      </div>

      <div class="eb-section">
        <div class="eb-grid cols-2">
          <div class="eb-field">
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


        <div class="eb-grid cols-2">
          <div class="eb-field">
            <label class="eb-label">Name prefix</label>
            <input v-model="s.prefix" class="eb-input" placeholder="(optional)" />
          </div>
          <div class="eb-field">
            <label class="eb-label">Name suffix</label>
            <input v-model="s.suffix" class="eb-input" placeholder="(optional)" />
          </div>
        </div>
        <div v-if="s.prefix || s.suffix" class="eb-muted" style="font-size:11.5px">
          Plate name → <span class="eb-mono">{{ s.prefix }}&lt;shot&gt;{{ s.suffix }}</span>
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

      <div class="eb-actions">
        <button class="eb-btn eb-btn--primary eb-btn--wide" :disabled="s.sending || !canSend" @click="doSend">
          {{ s.sending ? 'Sending…' : sendLabel }}
        </button>
        <span class="eb-muted">{{ s.message }}</span>
      </div>

      <div class="eb-section">
        <div class="eb-section-head">
          <h3 class="eb-section-title">Jobs</h3>
          <button
            v-if="s.jobs.length"
            class="eb-btn eb-btn--ghost eb-btn--mini"
            @click="doClearJobs"
          >Clear finished</button>
        </div>
        <div v-if="!s.jobs.length" class="eb-muted">No jobs yet.</div>
        <div v-else class="jobs">
          <div v-for="j in s.jobs" :key="j.job_id" class="job">
            <div>
              <div class="eb-mono job-name">{{ j.job_id }}</div>
              <div class="job-state">{{ stateLabel(j.state) }}</div>
            </div>
            <button
              v-if="j.state === 'returned'"
              class="eb-btn eb-btn--primary eb-btn--mini"
              :disabled="importingId === j.job_id"
              @click="doImport(j)"
            >{{ importingId === j.job_id ? 'Importing…' : 'Import to Avid' }}</button>
            <span v-else-if="j.state === 'done'" class="eb-stat"><b>imported</b></span>
            <span v-else-if="j.state === 'ready_in_ae'" class="eb-stat"><b>awaiting render</b></span>
            <span v-else class="eb-stat">
              <b>{{ j.project_mode === 'existing_project' ? 'shared' : 'per-shot' }}</b>
            </span>
          </div>
        </div>
      </div>

      <div class="eb-section">
        <div class="eb-section-head">
          <button class="log-toggle" :aria-expanded="String(s.logOpen)" @click="s.logOpen = !s.logOpen">
            <span class="log-caret" :class="{ 'is-open': s.logOpen }">›</span>
            <h3 class="eb-section-title" style="margin:0">Log</h3>
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
            <button class="eb-btn eb-btn--ghost eb-btn--mini" @click="copyLog">{{ copied ? 'Copied ✓' : 'Copy' }}</button>
            <button class="eb-btn eb-btn--ghost eb-btn--mini" @click="clearLog">Clear</button>
          </div>
        </div>
        <div v-if="!s.logOpen" class="eb-muted" style="font-size:11.5px">
          Hidden. Open it when something needs diagnosing, or to copy it here.
        </div>
        <div v-else-if="!logEntries.length" class="eb-muted">No log yet.</div>
        <div v-else class="eb-console" ref="logbox">
          <div v-for="(e, i) in logEntries" :key="i">
            <span class="c-dim">{{ e.t }}</span>
            <span :class="e.kind === 'error' ? 'c-bad' : 'c-accent'">{{ e.label }}</span>
            <span v-if="e.detail"> {{ e.detail }}</span>
          </div>
        </div>
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
const UI_BUILD = '2026-07-28.12 · collapsible log'

export default {
  name: 'AEBridgePanel',
  data() {
    return { s: state, uiBuild: UI_BUILD, picking: false, reading: false, importingId: null, logEntries: [], copied: false, autoGrabStatus: '', probing: false, _timer: null, _shotTimer: null, _logTimer: null }
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
      // Auto-refresh the current shot readout (MCAPI has no push events).
      this._shotTimer = setInterval(() => this.readShot(true), 1500)
    }
    this._timer = setInterval(this.refreshJobs, 4000)
    this._logTimer = setInterval(() => { this.logEntries = getMcapiLog() }, 1000)
  },
  beforeDestroy() {
    if (this._timer) clearInterval(this._timer)
    if (this._shotTimer) clearInterval(this._shotTimer)
    if (this._logTimer) clearInterval(this._logTimer)
  },
  watch: {
    's.exportSetting'(v) { this.savePref('exportSetting', v) },
    's.prefix'(v) { this.savePref('prefix', v) },
    's.suffix'(v) { this.savePref('suffix', v) },
    's.projectMode'(v) { this.savePref('projectMode', v) },
    's.logOpen'(v) { this.savePref('logOpen', v ? '1' : '0') }
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
        if (g('logOpen') != null) this.s.logOpen = g('logOpen') === '1'
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
      } catch (e) {
        this.s.helper = { online: false, version: null }
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
        this.s.jobs = jobs.slice().reverse()
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
    async doSend() {
      // Tokens don't survive a helper restart, but the remembered PATH does —
      // re-register it for a fresh token so the last project sticks.
      if (this.s.projectMode === 'existing_project' && !this.s.projectToken) {
        if (this.s.projectPath) {
          try {
            const r = await api.pickProject(this.s.projectPath)
            this.s.projectToken = r.target_project_token
            this.s.projectLabel = r.label
          } catch (e) {
            this.s.message = 'Saved project not found (' + (this.s.projectLabel || this.s.projectPath) + ') — Choose .aep… again.'
            return
          }
        } else {
          this.s.message = 'Choose a project first (Choose .aep…), or switch to New project per shot.'
          return
        }
      }
      this.s.sending = true
      try {
        const payload = {
          template_id: this.s.templateId,
          handles: Number(this.s.handles) || 0,
          project_mode: this.s.projectMode,
          // token = existing project to open, or new-project save location
          target_project_token: this.s.projectToken || null
        }

        if (this.s.inAvid) {
          // 1. plates were collected by Grab (one pass per track); compute the
          //    AE layer offsets across the collected set.
          const shot = { ...this.s.stackShot }
          const named = (this.s.prefix || '') + shot.shot_name + (this.s.suffix || '')
          shot.shot_name = named
          const grabbed = { shot }
          const plates = tl.plateOffsets(this.s.grabbed, Math.round(parseFloat(shot.frame_rate) || 24))
            .map((p) => ({
              ...p,
              name: (this.s.prefix || '') + p.name + (this.s.suffix || '')
            }))
          logMcapiVerbose('sending plates (final names)', {
            shot: named,
            prefix: this.s.prefix || null,
            suffix: this.s.suffix || null,
            plates: plates.map((p) => ({ track: 'V' + p.track, name: p.name, offset: p.offset_frames }))
          })
          // Warn if any plate would overwrite an existing file (they can add a
          // prefix/suffix). Every plate is checked — upper plates take their own
          // marker names, so a collision is not only possible on the base name.
          try {
            const clashes = []
            for (const p of plates) {
              const chk = await api.plateExists(p.name)
              if (chk.exists) clashes.push(...(chk.files || []))
            }
            if (clashes.length) {
              const ok = window.confirm(
                'These plate files already exist in the plates folder:\n\n' +
                clashes.join('\n') +
                '\n\nOverwrite them?\n(Cancel to add a name prefix/suffix, then Send again.)'
              )
              if (!ok) {
                this.s.message = 'Cancelled — add a prefix/suffix to rename, then Send again.'
                return
              }
            }
          } catch (e) { /* if the check fails, proceed */ }
          // 2. reserve the job + shared plates folder
          this.s.message = 'Preparing…'
          const prep = await api.prepare(named)
          // 3. export every plate in the stack (V1 base first, then _plNN)
          const exportedPlates = []
          for (let i = 0; i < plates.length; i += 1) {
            const p = plates[i]
            this.s.message = 'Exporting plate ' + (i + 1) + '/' + plates.length + ' (' + p.name + ')…'
            const file = await tl.exportShot({
              mobId: p.mobId,
              exportDir: prep.export_dir,
              fileName: p.name,
              exportSettingsName: this.s.exportSetting
            })
            exportedPlates.push({
              name: p.name,
              file,
              track: p.track,
              order: p.order,
              offset_frames: p.offset_frames || 0
            })
          }
          // 4. hand the real shot + plates to the helper (reference = V1 base)
          payload.job_id = prep.job_id
          payload.shot = grabbed.shot
          payload.reference_path = exportedPlates.length ? exportedPlates[0].file : null
          payload.plates = exportedPlates
        } else {
          this.s.message = 'Sending (placeholder shot)…'
        }

        const job = await api.send(payload)
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
