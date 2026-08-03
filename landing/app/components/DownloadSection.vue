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
  <section id="download" class="glow-top">
    <div class="wrap">
      <div class="sec-head" v-reveal>
        <div class="kicker">// download</div>
        <h2>Free. Open source. Yours.</h2>
        <p>One installer per platform. The in-app updater checks silently on launch and installs new versions automatically.</p>
      </div>
      <div class="os-grid">
        <div v-for="(os, i) in osCards" :key="os.name" class="os" v-spotlight v-reveal="{ delay: i * 110, variant: 'scale' }">
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
  position: relative;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px 28px;
  text-align: center;
  overflow: hidden;
  isolation: isolate;
  backdrop-filter: blur(10px);
  transition:
    transform 0.35s var(--ease-out),
    border-color 0.35s var(--ease-out),
    box-shadow 0.35s var(--ease-out);
}

.os::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    300px circle at var(--mx, 50%) var(--my, 50%),
    rgba(0, 120, 212, 0.14),
    transparent 65%
  );
  opacity: var(--spot-opacity, 0);
  transition: opacity 0.35s var(--ease-out);
  pointer-events: none;
  z-index: -1;
}

.os:hover {
  transform: translateY(-6px);
  border-color: rgba(77, 170, 252, 0.4);
  box-shadow: var(--shadow-md), var(--shadow-glow);
}

.os .os-ic {
  color: var(--accent-hi);
  margin-bottom: 14px;
  display: grid;
  place-items: center;
  transition: transform 0.45s var(--ease-spring);
}

.os:hover .os-ic {
  transform: translateY(-3px) scale(1.12);
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
