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
          Park the playhead on the shot; Send grabs that V1 clip from its source, with handles.
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

      <div class="eb-section">
        <div class="eb-section-head">
          <h3 class="eb-section-title">Log</h3>
          <div class="eb-actions">
            <button class="eb-btn eb-btn--ghost eb-btn--mini" @click="copyLog">{{ copied ? 'Copied ✓' : 'Copy' }}</button>
            <button class="eb-btn eb-btn--ghost eb-btn--mini" @click="clearLog">Clear</button>
          </div>
        </div>
        <div v-if="!logEntries.length" class="eb-muted">No log yet.</div>
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
const UI_BUILD = '2026-07-28.5 · V1 grab + V1 marker'

export default {
  name: 'AEBridgePanel',
  data() {
    return { s: state, uiBuild: UI_BUILD, picking: false, reading: false, importingId: null, logEntries: [], copied: false, _timer: null, _shotTimer: null, _logTimer: null }
  },
  computed: {
    logText() {
      return this.logEntries.map((e) => `${e.t} ${e.label}${e.detail ? ' ' + e.detail : ''}`).join('\n')
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
        if (g('projectPath') != null) this.s.projectPath = g('projectPath')
        if (g('projectLabel') != null) this.s.projectLabel = g('projectLabel')
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
          // 1. grab the marked shot (subclip + name) so we know the shot name
          this.s.message = 'Grabbing shot from Avid…'
          const grabbed = await tl.grabShot({
            destBinPath: this.s.destBin,
            handles: Number(this.s.handles) || 0,
            parseEdl: (edlPath) => api.parseEdl(edlPath).then((r) => r.clips)
          })
          // apply the user's prefix/suffix to the plate name (not the Avid clip)
          const named = (this.s.prefix || '') + grabbed.shot.shot_name + (this.s.suffix || '')
          grabbed.shot.shot_name = named
          // warn if a plate with this name already exists (they can add a prefix/suffix)
          try {
            const chk = await api.plateExists(named)
            if (chk.exists) {
              const ok = window.confirm(
                'A plate named "' + named + '" already exists in the plates folder:\n\n' +
                (chk.files || []).join('\n') +
                '\n\nOverwrite it?\n(Cancel to add a name prefix/suffix, then Send again.)'
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
</style>
