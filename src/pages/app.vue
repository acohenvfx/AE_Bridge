<template>
  <div class="eb-app" :data-dir="direction" :data-group="activeGroup">
    <section class="eb-content">
      <div class="eb-content-scroll">
        <AEBridgePanel />
      </div>
    </section>
  </div>
</template>

<script>
import panelToolShellMixin from '~/mixins/panelToolShellMixin'
import AEBridgePanel from '~/components/AEBridgePanel.vue'

// Single-tool panel: no sidebar. The nav/brand aside was vestigial (one tool,
// one nav item) and it was hidden below 900px anyway, which is where this panel
// usually sits docked in Avid. The app name lives in AEBridgePanel's tool head.
// The mixin is kept for `activeGroup` (which drives the accent hue) and so more
// tools can be registered later.
export default {
  name: 'AppPage',
  components: { AEBridgePanel },
  mixins: [panelToolShellMixin],
  data() {
    return {
      direction: 'vibrant'
    }
  }
}
</script>
