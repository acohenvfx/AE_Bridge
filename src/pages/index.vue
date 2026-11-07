<template>
  <main class="landing" data-group="bridge">
    <p class="eyebrow">AVID MEDIA COMPOSER TOOL</p>
    <h1>AEBridge</h1>
    <p class="lede">Move editorial plates from Avid to After Effects and bring finished versions back without losing the shot context.</p>

    <section class="beta-card" aria-labelledby="beta-title">
      <div>
        <p class="beta-label">BETA TESTER DOWNLOAD</p>
        <h2 id="beta-title">AEBridge v{{ version }}</h2>
        <p class="beta-copy">Signed and notarized beta installer with helper {{ version }} and the certified AVPI.</p>
        <p class="beta-warning">For beta testers on macOS. Save your work and fully quit Media Composer before installing; no Mac restart is required.</p>
      </div>
      <div class="downloads">
        <a class="download" href="/download/beta-installer">Download installer <span aria-hidden="true">↗</span></a>
        <a class="checksum" href="/download/beta-installer.sha256">SHA-256 checksum</a>
      </div>
    </section>

    <p class="launch">Already installed? <NuxtLink to="/app">Open the panel UI</NuxtLink>.</p>
    <p class="ver">v{{ version }}</p>
  </main>
</template>

<script>
export default {
  name: 'IndexPage',
  computed: {
    version() { return process.env.PANEL_VERSION || '0.0.1' },
  },
}
</script>

<style scoped>
.landing {
  min-height: 100vh;
  max-width: 820px;
  padding: 72px 32px;
  font-family: var(--font-display);
}
.eyebrow,
.beta-label {
  margin: 0;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
}
.landing h1 { margin: 14px 0 16px; font-size: clamp(38px, 7vw, 64px); line-height: 1; }
.lede { max-width: 650px; margin: 0; color: var(--muted); font-size: 18px; line-height: 1.55; }
.beta-card {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 30px;
  margin-top: 52px;
  padding: 28px;
  border: 1px solid var(--accent-line);
  border-radius: 18px;
  background: linear-gradient(135deg, var(--accent-soft), rgba(255, 255, 255, 0.02));
  box-shadow: var(--shadow-card);
}
.beta-card h2 { margin: 10px 0; font-size: 24px; }
.beta-copy,
.beta-warning { max-width: 500px; margin: 0; color: var(--muted); line-height: 1.5; }
.beta-warning { margin-top: 10px; color: var(--muted-2); font-size: 13px; }
.download {
  flex: 0 0 auto;
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--accent);
  box-shadow: var(--glow);
  color: var(--accent-ink) !important;
  font-family: var(--font-ui);
  font-weight: 800;
  text-decoration: none;
  white-space: nowrap;
}
.download:hover { filter: brightness(1.08); }
.downloads { display: flex; flex: 0 0 auto; flex-direction: column; align-items: center; gap: 10px; }
.checksum { color: var(--muted) !important; font-family: var(--font-mono); font-size: 11px; }
.launch { margin: 26px 0 0; color: var(--muted); }
.landing a { color: var(--accent); }
.ver { margin-top: 44px; color: var(--muted-2); font-family: var(--font-mono); font-size: 11px; }
@media (max-width: 640px) {
  .landing { padding: 48px 20px; }
  .beta-card { align-items: stretch; flex-direction: column; gap: 20px; }
  .downloads { align-items: stretch; }
  .download { text-align: center; }
}
</style>
