<script setup lang="ts">
import { Icon } from '@iconify/vue'

/**
 * Static force-graph mock, generated as pure markup so it's SSR-safe
 * (no DOM access needed). Mirrors the D3 graph view of v1.8.0.
 */
interface GNode {
  id: string
  x: number
  y: number
  core?: boolean
  agent?: boolean
  label: string
}

const nodes: GNode[] = [
  { id: 'n0', x: 120, y: 140, core: true, label: 'mdview' },
  { id: 'n1', x: 280, y: 70, label: 'note-1' },
  { id: 'n2', x: 380, y: 180, label: 'note-2' },
  { id: 'n3', x: 240, y: 260, agent: true, label: 'AGENTS.md' },
  { id: 'n4', x: 90, y: 260, label: 'note-4' },
]

const edges: Array<[string, string, boolean]> = [
  ['n0', 'n1', false],
  ['n0', 'n2', false],
  ['n0', 'n3', false],
  ['n3', 'n4', true],
  ['n2', 'n4', true],
  ['n1', 'n3', true],
]

const byId = new Map(nodes.map((n) => [n.id, n]))

const graphMarkup = computed(() => {
  const parts: string[] = []
  let ei = 0
  for (const [a, b, hi] of edges) {
    const na = byId.get(a)!
    const nb = byId.get(b)!
    const len = Math.hypot(nb.x - na.x, nb.y - na.y)
    parts.push(
      `<line x1="${na.x}" y1="${na.y}" x2="${nb.x}" y2="${nb.y}" class="${hi ? 'g-edge-hi' : 'g-edge'}" ` +
        `style="--len:${len};--i:${ei++}" />`,
    )
  }
  let ni = 0
  for (const n of nodes) {
    const cls = n.core
      ? 'g-node g-node-core'
      : n.agent
        ? 'g-node g-node-agent'
        : 'g-node'
    parts.push(
      `<g class="g-group" transform="translate(${n.x},${n.y})" style="--i:${ni++}">` +
        (n.core
          ? `<circle r="${n.core ? 26 : 22}" class="g-pulse" />`
          : '') +
        `<circle r="${n.core ? 26 : 22}" class="${cls}" />` +
        `<text x="0" y="4" text-anchor="middle" class="${n.core ? 'g-text g-text-hi' : 'g-text'}">${n.label}</text>` +
        `</g>`,
    )
  }
  return parts.join('')
})

const bulletPoints = [
  'Interactive force simulation, zero config',
  'Sidebar tab + full editor-pane tab view',
  'Backlinks panel lists every note pointing at the active file',
]

/** Trigger the SVG draw-in once the panel scrolls into view. */
const panelEl = ref<HTMLElement | null>(null)
const drawn = ref(false)
let io: IntersectionObserver | undefined

onMounted(() => {
  if (!panelEl.value) return
  io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          drawn.value = true
          io?.disconnect()
        }
      })
    },
    { threshold: 0.25 },
  )
  io.observe(panelEl.value)
})

onBeforeUnmount(() => io?.disconnect())
</script>

<template>
  <section id="graph" class="graph-sec glow-top">
    <div class="wrap graph-cols">
      <div v-reveal="{ variant: 'left' }">
        <div class="kicker">// v1.8.0</div>
        <h2>See your notes the way your brain does</h2>
        <p>
          The new D3 force-directed graph view renders every markdown file and internal link as a living
          network. Zoom, pan, drag nodes — click any node to open the file and expand it in the explorer.
        </p>
        <ul>
          <li v-for="(b, i) in bulletPoints" :key="b" :style="{ '--li': i }">{{ b }}</li>
        </ul>
        <a class="btn btn-primary" href="#download">
          <Icon icon="lucide:sparkles" width="15" height="15" /> Try it now
        </a>
      </div>

      <div ref="panelEl" class="graph-wrap" :class="{ drawn }" v-reveal="{ delay: 120, variant: 'right' }">
        <span class="g-label">graph: workspace.md</span>
        <svg class="graph" viewBox="0 0 480 340" v-html="graphMarkup" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.graph-sec {
  background: linear-gradient(180deg, transparent, rgba(0, 120, 212, 0.05) 40%, transparent);
}

.graph-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 56px;
  align-items: center;
}

.graph-cols h2 {
  font-size: 30px;
  color: #fff;
  margin-bottom: 14px;
}

.graph-cols p {
  color: var(--muted);
  font-size: 15px;
  margin: 16px 0 24px;
}

.graph-cols ul {
  list-style: none;
  display: grid;
  gap: 12px;
  margin-bottom: 30px;
}

.graph-cols li {
  display: flex;
  gap: 11px;
  font-size: 14.5px;
  color: var(--text);
  align-items: center;
}

.graph-cols li::before {
  content: '';
  width: 18px;
  height: 18px;
  flex: none;
  border-radius: 50%;
  background: rgba(76, 195, 138, 0.14);
  border: 1px solid rgba(76, 195, 138, 0.4);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%234cc38a' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
}

.graph-wrap {
  background: linear-gradient(180deg, rgba(13, 17, 23, 0.9), rgba(13, 17, 23, 0.75));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 18px;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-md);
}

/* soft inner glow */
.graph-wrap::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 30% 40%, rgba(0, 120, 212, 0.12), transparent 60%);
  pointer-events: none;
}

.g-label {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--dim);
  position: absolute;
  top: 12px;
  left: 16px;
  z-index: 1;
}

.graph {
  width: 100%;
  height: 340px;
  display: block;
}

@media (max-width: 960px) {
  .graph-cols {
    grid-template-columns: 1fr;
  }
}
</style>

<!-- SVG graph styles — v-html content, MUST be unscoped -->
<style>
.g-node {
  fill: rgba(0, 120, 212, 0.16);
  stroke: var(--accent);
  stroke-width: 1.5;
  cursor: pointer;
  transition:
    fill 0.3s var(--ease-out),
    stroke-width 0.3s var(--ease-out);
}

.g-node:hover {
  fill: rgba(0, 120, 212, 0.45);
  stroke-width: 2.2;
}

.g-node-core {
  fill: var(--accent);
}

.g-node-agent {
  fill: rgba(255, 158, 100, 0.18);
  stroke: #ff9e64;
}

/* pulsing halo behind the core node */
.g-pulse {
  fill: none;
  stroke: var(--accent-hi);
  stroke-width: 1.2;
  transform-origin: center;
  animation: g-halo 3s ease-out infinite;
}

@keyframes g-halo {
  0% { transform: scale(1); opacity: 0.55; }
  70% { transform: scale(1.9); opacity: 0; }
  100% { transform: scale(1.9); opacity: 0; }
}

.g-edge,
.g-edge-hi {
  stroke-dasharray: var(--len, 200);
  stroke-dashoffset: var(--len, 200);
}

.g-edge {
  stroke: #2f3b49;
  stroke-width: 1.2;
}

.g-edge-hi {
  stroke: var(--accent);
  stroke-width: 1.6;
}

/* draw the edges in once the panel enters the viewport */
.graph-wrap.drawn .g-edge,
.graph-wrap.drawn .g-edge-hi {
  animation: g-draw 0.85s var(--ease-out) forwards;
  animation-delay: calc(var(--i, 0) * 90ms);
}

@keyframes g-draw {
  to {
    stroke-dashoffset: 0;
  }
}

/* after drawing, the highlighted edges keep their marching-ants motion */
.graph-wrap.drawn .g-edge-hi {
  animation:
    g-draw 0.85s var(--ease-out) forwards,
    g-dash 2s linear 1.2s infinite;
}

@keyframes g-dash {
  from {
    stroke-dasharray: 4 3;
    stroke-dashoffset: 0;
  }
  to {
    stroke-dasharray: 4 3;
    stroke-dashoffset: -14;
  }
}

/* nodes pop in after their edges */
.g-group {
  opacity: 0;
}

.graph-wrap.drawn .g-group {
  animation: g-pop 0.55s var(--ease-spring) forwards;
  animation-delay: calc(320ms + var(--i, 0) * 85ms);
}

@keyframes g-pop {
  from {
    opacity: 0;
    transform: translate(var(--tx, 0), var(--ty, 0)) scale(0.4);
  }
  to {
    opacity: 1;
  }
}

.g-text {
  font-family: var(--font-mono);
  font-size: 10px;
  fill: var(--muted);
  pointer-events: none;
}

.g-text-hi {
  fill: #fff;
}
</style>
