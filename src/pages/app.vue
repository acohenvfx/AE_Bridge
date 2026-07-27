<template>
  <div class="eb-app" :data-dir="direction" :data-group="activeGroup">
    <aside class="eb-sidebar">
      <div class="eb-brand">
        <div class="eb-brand-kicker">ACOHENVFX</div>
        <div class="eb-brand-title"><span class="eb-brand-spark"></span> AE<b>Bridge</b></div>
      </div>
      <nav class="eb-nav">
        <div class="eb-group">
          <div class="eb-links">
            <button
              v-for="t in tools"
              :key="t.key"
              class="eb-link"
              :class="{ active: activeTool === t.key }"
              @click="setTool(t.key)"
            >
              <span class="eb-link-dot"></span>{{ t.label }}
            </button>
          </div>
        </div>
      </nav>
      <div class="eb-sidebar-foot">v{{ version }}</div>
    </aside>

    <section class="eb-content">
      <div class="eb-content-scroll">
        <AEBridgePanel v-if="activeTool === 'roundTrip'" />
      </div>
    </section>
  </div>
</template>

<script>
import panelToolShellMixin from '~/mixins/panelToolShellMixin'
import AEBridgePanel from '~/components/AEBridgePanel.vue'

export default {
  name: 'AppPage',
  components: { AEBridgePanel },
  mixins: [panelToolShellMixin],
  data() {
    return {
      direction: 'vibrant',
      version: process.env.PANEL_VERSION || '0.0.1'
    }
  }
}
</script>
