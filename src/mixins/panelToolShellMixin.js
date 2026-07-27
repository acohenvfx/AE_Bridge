// Tool routing / shell state. AEBridge currently ships a single tool, but this
// mirrors the EB mixin so more tools can be registered the same way.
export const TOOL_LABELS = {
  roundTrip: 'Round-trip'
}

export const TOOL_GROUP = {
  roundTrip: 'bridge'
}

export const PANEL_LAYOUT_COMPACT_MAX_PX = 900

export default {
  data() {
    return {
      activeTool: 'roundTrip',
      compact: false
    }
  },
  computed: {
    toolLabel() {
      return TOOL_LABELS[this.activeTool] || ''
    },
    activeGroup() {
      return TOOL_GROUP[this.activeTool] || 'bridge'
    },
    tools() {
      return Object.keys(TOOL_LABELS).map((key) => ({ key, label: TOOL_LABELS[key] }))
    }
  },
  mounted() {
    this._onResize = () => {
      this.compact = window.innerWidth <= PANEL_LAYOUT_COMPACT_MAX_PX
    }
    this._onResize()
    window.addEventListener('resize', this._onResize)
  },
  beforeDestroy() {
    if (this._onResize) window.removeEventListener('resize', this._onResize)
  },
  methods: {
    setTool(key) {
      if (TOOL_LABELS[key]) this.activeTool = key
    }
  }
}
