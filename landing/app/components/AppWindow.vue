<script setup lang="ts">
import { Icon } from '@iconify/vue'

/**
 * Hero window mock — an interactive preview of the app.
 * v-html content uses prefixed classes (aw-*) defined in the unscoped
 * style block below, since scoped styles do not apply to v-html output.
 */
interface MockTab {
  title: string
  editorHtml: string
  previewHtml: string
  treeActive: string
}

const tabs: MockTab[] = [
  {
    title: 'getting-started.md',
    treeActive: 'getting-started.md',
    editorHtml: `
      <span class="aw-h1"># Getting started</span>
      <br>Focus on the <span class="aw-strong">writing</span> — mdview
      <br>handles the tree, preview and
      <br>terminal around you.
      <br>
      <br><span class="aw-task">☑</span> Live GFM preview, scroll-synced
      <br><span class="aw-task">☑</span> KaTeX math: <span class="aw-math">$E = mc^2$</span>
      <br><span class="aw-task">☐</span> Mermaid diagrams
      <br>
      <br><span class="aw-fence">\`\`\`mermaid</span>
      <br><span class="aw-dim2">graph LR</span>
      <br><span class="aw-dim2">&nbsp;&nbsp;A[Idea] --&gt; B[Draft] --&gt; C[Docs]</span>
      <br><span class="aw-fence">\`\`\`</span>
      <span class="aw-caret"></span>`,
    previewHtml: `
      <h3>Getting started</h3>
      <div>Focus on the <b>writing</b> — mdview handles the tree, preview and terminal around you.</div>
      <div><span class="aw-check">☑</span> Live GFM preview, scroll-synced</div>
      <div><span class="aw-check">☑</span> KaTeX math: <span class="aw-math">E = mc²</span></div>
      <div><span class="aw-check off">☐</span> Mermaid diagrams</div>
      <div class="aw-mermaid"><span class="aw-n">Idea</span><span class="aw-a">──▶</span><span class="aw-n">Draft</span><span class="aw-a">──▶</span><span class="aw-n">Docs</span></div>
      <div class="aw-hint">Press <span class="aw-kbd">Cmd+P</span> to jump anywhere.</div>`,
  },
  {
    title: 'AGENTS.md',
    treeActive: 'AGENTS.md',
    editorHtml: `
      <span class="aw-h1"># AGENTS.md</span>
      <br>Instructions for the AI agent
      <br>working in this repository.
      <br>
      <br><span class="aw-strong">Rules:</span>
      <br><span class="aw-task">☑</span> Read docs before coding
      <br><span class="aw-task">☑</span> Run typecheck before commit
      <br><span class="aw-task">☐</span> Update CHANGELOG
      <br>
      <br><span class="aw-dim2"># agent-recognized file</span>
      <span class="aw-caret"></span>`,
    previewHtml: `
      <h3>AGENTS.md</h3>
      <div>Instructions for the AI agent working in this repository.</div>
      <div class="aw-mt"><b>Rules:</b></div>
      <div><span class="aw-check">☑</span> Read docs before coding</div>
      <div><span class="aw-check">☑</span> Run typecheck before commit</div>
      <div><span class="aw-check off">☐</span> Update CHANGELOG</div>
      <div class="aw-mermaid"><span class="aw-n"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px;color:#ff9e64"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>agent</span><span class="aw-a">──▶</span><span class="aw-n">mdview</span></div>`,
  },
  {
    title: '2026-08-03.md',
    treeActive: '2026-08-03.md',
    editorHtml: `
      <span class="aw-h1"># 2026-08-03</span>
      <br><span class="aw-dim2">> created with Alt+D</span>
      <br>
      <br>Morning — shipped the
      <br><span class="aw-link">[[graph-view]]</span> backlinks panel.
      <br>Next: <span class="aw-del">publish docs</span> →
      <br><span class="aw-link">[[landing-page]]</span>
      <br>
      <br><span class="aw-math">$\\sum_{notes} focus = \\infty$</span>
      <span class="aw-caret"></span>`,
    previewHtml: `
      <h3>2026-08-03</h3>
      <div><i>created with Alt+D</i></div>
      <div class="aw-mt">Morning — shipped the <a class="aw-link">[[graph-view]]</a> backlinks panel. Next: publish docs → <a class="aw-link">[[landing-page]]</a></div>
      <div class="aw-mt aw-math">Σ notes focus = ∞</div>`,
  },
]

const treeFiles = [
  { name: 'getting-started.md', icon: 'lucide:file-text', agent: false },
  { name: 'AGENTS.md', icon: 'lucide:bot', agent: true },
  { name: '2026-08-03.md', icon: 'lucide:notebook', agent: false },
]

const active = ref(0)
const current = computed(() => tabs[active.value] ?? tabs[0]!)

function select(i: number) {
  active.value = i
}
</script>

<template>
  <div class="window">
    <div class="win-bar">
      <span class="dots"><i></i><i></i><i></i></span>
      <div class="win-tabs">
        <button
          v-for="(t, i) in tabs"
          :key="t.title"
          class="win-tab"
          :class="{ active: i === active }"
          type="button"
          @click="select(i)"
        >
          {{ t.title }}
        </button>
      </div>
    </div>

    <div class="win-body">
      <div class="tree">
        <div
          v-for="f in treeFiles"
          :key="f.name"
          class="file"
          :class="{ active: f.name === current.treeActive }"
          :style="{ opacity: 1 }"
        >
          <Icon :icon="f.icon" width="11" height="11" class="t-ic" :class="{ agent: f.agent }" /> {{ f.name }}
        </div>
        <div class="dim"><Icon icon="lucide:folder" width="11" height="11" class="t-ic" /> guides/ <span class="dim-sub">(no .md)</span></div>
        <div class="lvl2 file"><Icon icon="lucide:file-text" width="11" height="11" class="t-ic" /> architecture.md</div>
        <div class="lvl2 file"><Icon icon="lucide:link" width="11" height="11" class="t-ic" /> backlinks.md</div>
      </div>

      <div class="editor" v-html="current.editorHtml" />

      <div class="preview" v-html="current.previewHtml" />
    </div>

    <div class="win-status">
      <span class="ok">● ptys: 2</span>
      <span>✓ saved</span>
      <span class="sp">EN · VI</span>
    </div>
  </div>
</template>

<style scoped>
.window {
  background: var(--bg-code);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.02);
  overflow: hidden;
}

.win-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-3);
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}

.dots {
  display: flex;
  gap: 6px;
}

.dots i {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  display: block;
}

.dots i:nth-child(1) { background: #ff5f57; }
.dots i:nth-child(2) { background: #febc2e; }
.dots i:nth-child(3) { background: #28c840; }

.win-tabs {
  display: flex;
  gap: 4px;
  margin-left: 14px;
  overflow: hidden;
}

.win-tab {
  font-family: var(--font-mono);
  font-size: 11.5px;
  padding: 4px 12px;
  border-radius: 4px 4px 0 0;
  cursor: pointer;
  color: var(--dim);
  white-space: nowrap;
  background: transparent;
  border: none;
  transition: color 0.15s;
}

.win-tab.active {
  background: var(--bg-code);
  color: #fff;
  box-shadow: inset 0 -2px 0 var(--accent);
}

.win-tab:hover {
  color: #fff;
}

.win-body {
  display: grid;
  grid-template-columns: 150px 1fr 1fr;
  min-height: 330px;
}

.tree {
  padding: 12px 8px;
  border-right: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 11.5px;
  line-height: 1.9;
  color: var(--muted);
  background: #161b22;
}

.tree .dim {
  opacity: 0.35;
  padding: 1px 6px;
}

.tree .dim-sub {
  opacity: 0.7;
}

.tree .lvl2 {
  padding-left: 14px;
}

.tree .file {
  cursor: pointer;
  padding: 1px 6px;
  border-radius: 3px;
}

.tree .file:hover {
  background: var(--bg-hover);
}

.tree .file.active {
  background: var(--bg-selected);
  color: #fff;
}

.tree .t-ic {
  color: var(--dim);
  vertical-align: -1px;
  margin-right: 3px;
}

.tree .t-ic.agent {
  color: #ff9e64;
}

.editor {
  padding: 16px 18px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.75;
  color: #d6dde5;
  border-right: 1px solid var(--border);
  overflow: hidden;
  position: relative;
}

.preview {
  padding: 16px 18px;
  font-size: 12.5px;
  line-height: 1.75;
  color: #d6dde5;
  overflow: hidden;
}

.win-status {
  display: flex;
  gap: 16px;
  align-items: center;
  background: var(--bg-3);
  border-top: 1px solid var(--border);
  padding: 7px 14px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--dim);
}

.win-status .ok {
  color: #4cc38a;
}

.win-status .sp {
  margin-left: auto;
}

@media (max-width: 960px) {
  .win-body {
    grid-template-columns: 1fr 1fr;
  }
  .tree {
    display: none;
  }
}

@media (max-width: 640px) {
  .win-body {
    grid-template-columns: 1fr;
  }
  .preview {
    display: none;
  }
}
</style>

<!-- v-html content styles — MUST be unscoped -->
<style>
.aw-h1 {
  color: #fff;
  font-weight: 600;
  font-size: 14px;
}
.aw-strong {
  color: #fff;
  font-weight: 600;
}
.aw-link {
  color: var(--accent-hi);
}
.aw-del {
  color: var(--dim);
  text-decoration: line-through;
}
.aw-task {
  color: #4cc38a;
}
.aw-math {
  color: #c792ea;
}
.aw-fence {
  color: #ff7b72;
}
.aw-dim2 {
  color: #8b949e;
}
.aw-caret {
  display: inline-block;
  width: 7px;
  height: 15px;
  background: var(--accent-hi);
  vertical-align: -2px;
  animation: aw-blink 1.1s steps(2) infinite;
}
@keyframes aw-blink {
  50% {
    opacity: 0;
  }
}
.aw-check {
  color: #4cc38a;
}
.aw-check.off {
  color: var(--dim);
}
.aw-mt {
  margin-top: 8px;
}
.aw-hint {
  margin-top: 14px;
  color: var(--muted);
}
.aw-kbd {
  font-family: var(--font-mono);
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 0 5px;
  font-size: 11px;
}
.aw-mermaid {
  margin-top: 10px;
  border: 1px solid #30363d;
  background: #0f1419;
  border-radius: 6px;
  padding: 10px 12px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  line-height: 1.5;
}
.aw-n {
  display: inline-block;
  border: 1px solid var(--accent);
  color: var(--accent-hi);
  border-radius: 4px;
  padding: 1px 7px;
  margin: 2px;
}
.aw-a {
  color: var(--dim);
  margin: 0 5px;
}
.preview h3 {
  font-size: 14px;
  color: #fff;
  margin-bottom: 6px;
}
</style>
