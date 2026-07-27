<template>
  <main class="landing">
    <h1>AEBridge</h1>
    <p>Avid ↔ After Effects round-trip. Open <code>/app</code> for the panel.</p>
    <NuxtLink class="go" to="/app">Open panel</NuxtLink>
  </main>
</template>

<script>
export default { name: 'IndexPage' }
</script>

<style scoped>
.landing { padding: 40px; font-family: var(--font-ui); color: var(--ink); }
h1 { font-family: var(--font-display); }
code { font-family: var(--font-mono); color: var(--accent); }
.go { display: inline-block; margin-top: 16px; }
</style>
