<script setup lang="ts">
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
  for (const [a, b, hi] of edges) {
    const na = byId.get(a)!
    const nb = byId.get(b)!
    parts.push(
      `<line x1="${na.x}" y1="${na.y}" x2="${nb.x}" y2="${nb.y}" class="${hi ? 'g-edge-hi' : 'g-edge'}" />`,
    )
  }
  for (const n of nodes) {
    const cls = n.core
      ? 'g-node g-node-core'
      : n.agent
        ? 'g-node g-node-agent'
        : 'g-node'
    parts.push(
      `<g transform="translate(${n.x},${n.y})">` +
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
</script>

<template>
  <section id="graph" class="graph-sec">
    <div class="wrap graph-cols">
      <div v-reveal>
        <div class="kicker">// v1.8.0</div>
        <h2>See your notes the way your brain does</h2>
        <p>
          The new D3 force-directed graph view renders every markdown file and internal link as a living
          network. Zoom, pan, drag nodes — click any node to open the file and expand it in the explorer.
        </p>
        <ul>
          <li v-for="b in bulletPoints" :key="b">{{ b }}</li>
        </ul>
        <a class="btn btn-primary" href="#download">Try it now</a>
      </div>

      <div class="graph-wrap" v-reveal="150">
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
  gap: 10px;
  margin-bottom: 28px;
}

.graph-cols li {
  display: flex;
  gap: 10px;
  font-size: 14px;
  color: var(--text);
}

.graph-cols li::before {
  content: '✓';
  color: #4cc38a;
  font-weight: 700;
}

.graph-wrap {
  background: var(--bg-code);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px;
  position: relative;
  overflow: hidden;
}

.g-label {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--dim);
  position: absolute;
  top: 10px;
  left: 14px;
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
}
.g-node:hover {
  fill: rgba(0, 120, 212, 0.4);
}
.g-node-core {
  fill: var(--accent);
}
.g-node-agent {
  fill: rgba(255, 158, 100, 0.18);
  stroke: #ff9e64;
}
.g-edge {
  stroke: #2f3b49;
  stroke-width: 1.2;
}
.g-edge-hi {
  stroke: var(--accent);
  stroke-width: 1.6;
  stroke-dasharray: 4 3;
  animation: g-dash 2s linear infinite;
}
@keyframes g-dash {
  to {
    stroke-dashoffset: -14;
  }
}
.g-text {
  font-family: var(--font-mono);
  font-size: 10px;
  fill: var(--muted);
}
.g-text-hi {
  fill: var(--accent-hi);
}
</style>
