<script setup lang="ts">
import { Icon } from '@iconify/vue'

const GITHUB = 'https://github.com/aniadev/mdview'

/** Rotating words in the hero headline. */
const words = ['Stay in flow.', 'Ship the docs.', 'Think in links.']
const wordIndex = ref(0)
const typed = ref('')
const typingDone = ref(false)

let timer: ReturnType<typeof setTimeout> | undefined

function typeLoop() {
  const full = words[wordIndex.value]!
  let i = 0
  typingDone.value = false

  const type = () => {
    typed.value = full.slice(0, ++i)
    if (i < full.length) {
      timer = setTimeout(type, 55)
    } else {
      typingDone.value = true
      timer = setTimeout(erase, 2600)
    }
  }

  const erase = () => {
    typed.value = full.slice(0, --i)
    if (i > 0) {
      timer = setTimeout(erase, 26)
    } else {
      wordIndex.value = (wordIndex.value + 1) % words.length
      timer = setTimeout(typeLoop, 260)
    }
  }

  timer = setTimeout(type, 260)
}

onMounted(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    typed.value = words[0]!
    typingDone.value = true
    return
  }
  typeLoop()
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div id="top">
    <!-- ================= HERO ================= -->
    <header class="hero">
      <div class="wrap hero-grid">
        <div class="hero-copy">
          <a class="badge" href="https://github.com/aniadev/mdview/releases" target="_blank" rel="noopener">
            <span class="dot" />
            <span>v1.8.0 — Graph View + Backlinks</span>
            <Icon icon="lucide:arrow-right" width="12" height="12" class="badge-arrow" />
          </a>

          <h1>
            <span class="line-1">Write Markdown.</span><br>
            <span class="grad typed">{{ typed }}<span class="type-caret" :class="{ blink: typingDone }" /></span>
          </h1>

          <p class="sub">
            A focused Markdown workspace editor for developers, writers, and AI practitioners.
            Smart file tree, split-pane live preview, integrated terminal — zero bloat.
          </p>

          <div class="cta-row">
            <a class="btn btn-primary" href="#download">
              <Icon icon="lucide:download" width="15" height="15" /> Download for macOS
            </a>
            <a class="btn btn-ghost" :href="GITHUB" target="_blank" rel="noopener">
              <Icon icon="lucide:github" width="15" height="15" /> View on GitHub
            </a>
          </div>

          <div class="trust-row">
            <span><Icon icon="lucide:check" width="13" height="13" /> Free &amp; open source</span>
            <span><Icon icon="lucide:check" width="13" height="13" /> macOS · Windows · Linux</span>
            <span><Icon icon="lucide:check" width="13" height="13" /> Auto-updating</span>
          </div>
        </div>

        <div class="window-slot">
          <AppWindow />
        </div>
      </div>

      <div class="scroll-hint" aria-hidden="true">
        <Icon icon="lucide:chevron-down" width="18" height="18" />
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
  padding: 110px 0 90px;
  position: relative;
  overflow: hidden;
}

.hero-grid {
  display: grid;
  grid-template-columns: 1fr 1.08fr;
  gap: 56px;
  align-items: center;
}

/* ---- entrance stagger (runs once on load, no observer needed) ---- */
.hero-copy > * {
  animation: hero-in 0.9s var(--ease-out) backwards;
}
.hero-copy > .badge { animation-delay: 0.05s; }
.hero-copy > h1 { animation-delay: 0.15s; }
.hero-copy > .sub { animation-delay: 0.28s; }
.hero-copy > .cta-row { animation-delay: 0.4s; }
.hero-copy > .trust-row { animation-delay: 0.52s; }

.window-slot {
  min-width: 0;
  animation: window-in 1.1s var(--ease-out) 0.3s backwards;
}

@keyframes hero-in {
  from {
    opacity: 0;
    transform: translateY(24px);
    filter: blur(8px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: blur(0);
  }
}

@keyframes window-in {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.97) rotateX(6deg);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* ---- badge ---- */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.035);
  backdrop-filter: blur(8px);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 12.5px;
  color: var(--muted);
  margin-bottom: 26px;
  transition:
    border-color 0.25s var(--ease-out),
    color 0.25s var(--ease-out),
    transform 0.25s var(--ease-out);
}

.badge:hover {
  border-color: rgba(77, 170, 252, 0.5);
  color: var(--text);
  text-decoration: none;
  transform: translateY(-1px);
}

.badge .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4cc38a;
  box-shadow: 0 0 0 0 rgba(76, 195, 138, 0.65);
  animation: ping 2.4s ease-out infinite;
}

@keyframes ping {
  0% { box-shadow: 0 0 0 0 rgba(76, 195, 138, 0.6); }
  70% { box-shadow: 0 0 0 7px rgba(76, 195, 138, 0); }
  100% { box-shadow: 0 0 0 0 rgba(76, 195, 138, 0); }
}

.badge-arrow {
  transition: transform 0.25s var(--ease-out);
}

.badge:hover .badge-arrow {
  transform: translateX(3px);
}

/* ---- headline ---- */
h1 {
  font-size: 58px;
  line-height: 1.06;
  font-weight: 800;
  letter-spacing: -2px;
  color: #fff;
  margin-bottom: 22px;
  min-height: 2.12em;
}

.line-1 {
  background: linear-gradient(180deg, #ffffff 40%, #c8d0da);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.grad {
  background: linear-gradient(96deg, #4daafc, #0078d4 60%, #6fb8ff);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: shimmer 6s linear infinite;
}

@keyframes shimmer {
  to {
    background-position: 200% center;
  }
}

.type-caret {
  display: inline-block;
  width: 3px;
  height: 0.86em;
  margin-left: 4px;
  vertical-align: -0.08em;
  background: var(--accent-hi);
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(77, 170, 252, 0.8);
}

.type-caret.blink {
  animation: caret-blink 1.05s steps(2) infinite;
}

@keyframes caret-blink {
  50% { opacity: 0; }
}

.sub {
  font-size: 17.5px;
  color: var(--muted);
  max-width: 500px;
  margin-bottom: 34px;
}

.cta-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 26px;
}

/* ---- trust row ---- */
.trust-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  font-size: 12.5px;
  color: var(--dim);
}

.trust-row span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.trust-row svg {
  color: #4cc38a;
}

/* ---- scroll hint ---- */
.scroll-hint {
  position: absolute;
  bottom: 26px;
  left: 50%;
  transform: translateX(-50%);
  color: var(--dim);
  animation: bob 2.2s ease-in-out infinite;
}

@keyframes bob {
  0%, 100% { transform: translate(-50%, 0); opacity: 0.45; }
  50% { transform: translate(-50%, 7px); opacity: 0.9; }
}

@media (max-width: 960px) {
  .hero {
    padding: 68px 0 60px;
  }
  .hero-grid {
    grid-template-columns: 1fr;
    gap: 44px;
  }
  h1 {
    font-size: 40px;
  }
  .scroll-hint {
    display: none;
  }
}
</style>
