// Template sanity check for the panel SFC. Run: node tools/check-vue-template.js src/components/AEBridgePanel.vue
//
// Catches the failure Vue does NOT report: a `v-else` placed mid-chain silently
// drops every branch after it. That once left the whole MCAPI log unrendered.
// Vue compiles `v-if / v-else / v-else-if / v-else` happily and silently drops
// the branches after the first v-else. Walk the compiled AST and flag any
// conditions block whose v-else is not last.
const fs = require('fs')
const c = require('vue-template-compiler')
const src = fs.readFileSync(process.argv[2], 'utf8')
const tpl = src.match(/<template>([\s\S]*)<\/template>/)[1]
const r = c.compile(tpl, { outputSourceRange: true })
if (r.errors && r.errors.length) { console.error('TEMPLATE ERRORS:', r.errors); process.exit(1) }
let bad = []
function walk(node) {
  if (!node) return
  if (node.ifConditions && node.ifConditions.length > 1) {
    const conds = node.ifConditions
    for (let i = 0; i < conds.length - 1; i++) {
      if (!conds[i].exp) {
        bad.push({ tag: node.tag, after: conds[i + 1].exp || '(v-else)', dropped: conds.length - i - 1 })
      }
    }
  }
  ;(node.children || []).forEach(walk)
  ;(node.ifConditions || []).forEach((cc) => { if (cc.block !== node) walk(cc.block) })
}
walk(r.ast)
if (bad.length) {
  console.error('UNREACHABLE BRANCHES (a v-else is not last in its chain):')
  for (const b of bad) console.error('  <' + b.tag + '> — ' + b.dropped + ' branch(es) after the v-else never render; next was: ' + b.after)
  process.exit(1)
}
console.log('no unreachable v-else branches')
