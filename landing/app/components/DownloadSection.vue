<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface OsCard {
  icon: string
  name: string
  desc: string
  label: string
  note: string
}

const RELEASES = 'https://github.com/aniadev/mdview/releases'

const osCards: OsCard[] = [
  {
    icon: 'lucide:apple',
    name: 'macOS',
    desc: 'Universal binary — Apple Silicon & Intel',
    label: 'Download .dmg',
    note: 'ad-hoc signed · Gatekeeper guide included',
  },
  {
    icon: 'lucide:monitor',
    name: 'Windows',
    desc: 'x64 & arm64 — NSIS + MSI installers',
    label: 'Download .exe',
    note: 'auto-update supported',
  },
  {
    icon: 'lucide:shell',
    name: 'Linux',
    desc: 'x86_64 — AppImage + .deb',
    label: 'Download .AppImage',
    note: 'Ubuntu/Debian targets',
  },
]
</script>

<template>
  <section id="download">
    <div class="wrap">
      <div class="sec-head" v-reveal>
        <div class="kicker">// download</div>
        <h2>Free. Open source. Yours.</h2>
        <p>One installer per platform. The in-app updater checks silently on launch and installs new versions automatically.</p>
      </div>
      <div class="os-grid">
        <div v-for="(os, i) in osCards" :key="os.name" class="os" v-reveal="i * 100">
          <div class="os-ic"><Icon :icon="os.icon" width="30" height="30" /></div>
          <h3>{{ os.name }}</h3>
          <p>{{ os.desc }}</p>
          <a class="btn btn-primary btn-sm" :href="RELEASES" target="_blank" rel="noopener">
            <Icon icon="lucide:download" width="13" height="13" /> {{ os.label }}
          </a>
          <div class="note">{{ os.note }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.os-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  max-width: 900px;
  margin: 0 auto;
}

.os {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 28px;
  text-align: center;
  transition:
    transform 0.18s,
    border-color 0.18s;
}

.os:hover {
  transform: translateY(-4px);
  border-color: var(--accent);
}

.os .os-ic {
  color: var(--accent-hi);
  margin-bottom: 12px;
  display: grid;
  place-items: center;
}

.os h3 {
  color: #fff;
  font-size: 16px;
  margin-bottom: 6px;
}

.os p {
  font-size: 12.5px;
  color: var(--muted);
  margin-bottom: 18px;
}

.os .note {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--dim);
  margin-top: 12px;
}

@media (max-width: 640px) {
  .os-grid {
    grid-template-columns: 1fr;
  }
}
</style>
