<script setup lang="ts">
import { Icon } from '@iconify/vue'

const GITHUB = 'https://github.com/aniadev/mdview'
</script>

<template>
  <div id="top">
    <!-- ================= HERO ================= -->
    <header class="hero">
      <div class="wrap hero-grid">
        <div>
          <span class="badge">
            <span class="dot"></span> v1.8.0 — Graph View + Backlinks released
          </span>
          <h1>
            Write Markdown.<br>
            <span class="grad">Stay in flow.</span>
          </h1>
          <p class="sub">
            A focused Markdown workspace editor for developers, writers, and AI practitioners.
            Smart file tree, split-pane live preview, integrated terminal — zero bloat.
          </p>
          <div class="cta-row">
            <a class="btn btn-primary" href="#download"><Icon icon="lucide:download" width="14" height="14" />&nbsp; Download for macOS</a>
            <a class="btn btn-ghost" :href="GITHUB" target="_blank" rel="noopener">View on GitHub</a>
          </div>
          <p class="mini">
            <b>macOS Universal</b> · Windows x64/arm64 · Linux x86_64 — free &amp; open source (MIT)
          </p>
        </div>

        <div class="window-slot" v-reveal>
          <AppWindow />
        </div>
      </div>
    </header>

    <!-- ================= SECTIONS ================= -->
    <FeatureGrid />
    <AiStrip />
    <GraphSection />
    <ShortcutsSection />
    <DownloadSection />
  </div>
</template>

<style scoped>
.hero {
  padding: 96px 0 72px;
  position: relative;
  overflow: hidden;
}

.hero-grid {
  display: grid;
  grid-template-columns: 1fr 1.05fr;
  gap: 56px;
  align-items: center;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 22px;
}

.badge .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4cc38a;
  box-shadow: 0 0 8px #4cc38a;
}

h1 {
  font-size: 52px;
  line-height: 1.08;
  font-weight: 800;
  letter-spacing: -1.5px;
  color: #fff;
  margin-bottom: 20px;
}

.grad {
  background: linear-gradient(90deg, #4daafc, #0078d4);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.sub {
  font-size: 17px;
  color: var(--muted);
  max-width: 480px;
  margin-bottom: 32px;
}

.cta-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.mini {
  font-size: 12.5px;
  color: var(--dim);
}

.mini b {
  color: var(--muted);
  font-weight: 600;
}

.window-slot {
  min-width: 0;
}

@media (max-width: 960px) {
  .hero {
    padding: 64px 0 56px;
  }
  .hero-grid {
    grid-template-columns: 1fr;
    gap: 40px;
  }
  h1 {
    font-size: 38px;
  }
}
</style>
