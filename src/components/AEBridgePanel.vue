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
          Mark IN/OUT around the shot on the timeline; Send grabs that range via a subclip.
        </div>

        <div v-if="s.inAvid" class="eb-actions">
          <button class="eb-btn eb-btn--ghost eb-btn--mini" :disabled="analyzing" @click="analyzeRange">
            {{ analyzing ? 'Analyzing…' : 'Analyze V1 clips (4a)' }}
          </button>
          <span class="eb-muted">{{ analyzeMsg }}</span>
        </div>
        <div v-if="detectedClips.length" class="eb-table-wrap" style="max-height:220px;overflow:auto">
          <table class="eb-table">
            <thead><tr><th>Track</th><th>Clip</th><th>Rec In</th><th>Rec Out</th></tr></thead>
            <tbody>
              <tr v-for="(c, i) in detectedClips" :key="i" :class="{ 'is-found': c.track === 1 }">
                <td class="eb-mono">V{{ c.track }}</td>
                <td>{{ c.clip_name || '(unnamed)' }}</td>
                <td class="eb-mono">{{ c.rec_in }}</td>
                <td class="eb-mono">{{ c.rec_out }}</td>
              </tr>
            </tbody>
          </table>
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
        <button class="eb-btn eb-btn--primary eb-btn--wide" :disabled="s.sending" @click="doSend">
          {{ s.sending ? 'Sending…' : 'Send to After Effects' }}
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
    </div>
  </div>
</template>

<script>
import { aebridge as state } from '~/store/toolState'
import * as api from '~/utils/api/aebridge'
import * as tl from '~/utils/api/timeline'

export default {
  name: 'AEBridgePanel',
  data() {
    return { s: state, picking: false, reading: false, importingId: null, analyzing: false, analyzeMsg: '', detectedClips: [], _timer: null, _shotTimer: null }
  },
  async mounted() {
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
  },
  beforeDestroy() {
    if (this._timer) clearInterval(this._timer)
    if (this._shotTimer) clearInterval(this._shotTimer)
  },
  watch: {
    's.exportSetting'(v) { this.savePref('exportSetting', v) },
    's.prefix'(v) { this.savePref('prefix', v) },
    's.suffix'(v) { this.savePref('suffix', v) },
    's.projectMode'(v) { this.savePref('projectMode', v) }
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
    },
    async analyzeRange() {
      this.analyzing = true
      this.analyzeMsg = ''
      this.detectedClips = []
      try {
        const seq = await tl.getRecordSequence()
        const tracks = await tl.getMobTrackInfo(seq.mobId)
        const vids = tl.videoTracks(tracks)
        if (!vids.length) {
          this.analyzeMsg = 'No enabled video tracks with content.'
          return
        }
        const v1 = vids[0]
        // Derive the marked record range: marks-subclip V1 (respects marks) →
        // match to V1 EDL → record range. Then filter every track to it.
        const v1Path = await tl.exportEdlForTrack(seq.mobId, v1)
        const v1Events = v1Path ? (await api.parseEdl(v1Path)).clips : []
        const marked = await tl.getMarkedTrackClips({ sequenceMobId: seq.mobId, scratchBin: 'AEBridge_Scratch', track: v1 })
        const range = tl.deriveMarkedRange(marked, v1Events)

        const all = []
        for (const t of vids) {
          const edlPath = await tl.exportEdlForTrack(seq.mobId, t)
          if (!edlPath) continue
          const r = range
            ? await api.parseEdl(edlPath, range.recIn, range.recOut)
            : await api.parseEdl(edlPath)
          for (const c of r.clips) all.push({ ...c, track: t.number })
        }
        all.sort((a, b) => (a.rec_in < b.rec_in ? -1 : a.rec_in > b.rec_in ? 1 : a.track - b.track))
        this.detectedClips = all
        this.analyzeMsg = range
          ? all.length + ' clip(s) in marked range (' + range.recIn + '-' + range.recOut + ') across ' + vids.map((t) => 'V' + t.number).join(', ')
          : all.length + ' clip(s) - could NOT derive marked range (showing whole sequence)'
      } catch (e) {
        this.analyzeMsg = 'Analyze error: ' + e.message
      } finally {
        this.analyzing = false
      }
    },
    setMode(mode) {
      this.s.projectMode = mode
      this.s.projectToken = null
      this.s.projectLabel = ''
    },
    async choose() {
      this.picking = true
      try {
        const r = this.s.projectMode === 'new_per_shot'
          ? await api.newProject()
          : await api.pickProject()
        this.s.projectToken = r.target_project_token
        this.s.projectLabel = r.label
      } catch (e) {
        this.s.projectLabel = 'cancelled / unavailable'
      } finally {
        this.picking = false
      }
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
          // 1. grab the marked shot (subclip + name) so we know the shot name
          this.s.message = 'Grabbing shot from Avid…'
          const grabbed = await tl.grabShot({
            destBinPath: this.s.destBin,
            handles: Number(this.s.handles) || 0
          })
          // apply the user's prefix/suffix to the plate name (not the Avid clip)
          const named = (this.s.prefix || '') + grabbed.shot.shot_name + (this.s.suffix || '')
          grabbed.shot.shot_name = named
          // 2. reserve a <date>_<shot> folder (PLATE/RENDER) from the helper
          this.s.message = 'Preparing…'
          const prep = await api.prepare(named)
          // 3. export the plate into the PLATE folder
          this.s.message = 'Exporting plate…'
          const referencePath = await tl.exportShot({
            mobId: grabbed.exportMobId,
            exportDir: prep.export_dir,
            fileName: named,
            exportSettingsName: this.s.exportSetting
          })
          // 4. hand the real shot + reference to the helper
          payload.job_id = prep.job_id
          payload.shot = grabbed.shot
          payload.reference_path = referencePath
        } else {
          this.s.message = 'Sending (placeholder shot)…'
        }

        const job = await api.send(payload)
        this.s.message = 'Sent — ' + job.job_id + ' (' + this.stateLabel(job.state) + ')'
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
</style>
