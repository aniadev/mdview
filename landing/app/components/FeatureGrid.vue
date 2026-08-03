<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface Feature {
  icon: string
  title: string
  desc: string
  tag: string
}

const features: Feature[] = [
  {
    icon: 'lucide:folder-tree',
    title: 'Smart file tree',
    desc: 'Folders without any .md inside are dimmed automatically. Your notes surface, node_modules disappears.',
    tag: 'auto-dimming',
  },
  {
    icon: 'lucide:panel-right',
    title: 'Live GFM preview',
    desc: 'Split-pane editor ↔ preview with drift-free heading-segment scroll sync. Checklists are clickable in both panes.',
    tag: 'markdown-it',
  },
  {
    icon: 'lucide:sigma',
    title: 'Math + diagrams',
    desc: 'KaTeX inline and block math, plus fenced ```mermaid``` blocks that lazy-load only when needed.',
    tag: 'KaTeX · Mermaid',
  },
  {
    icon: 'lucide:terminal',
    title: 'Integrated terminal',
    desc: 'A real PTY panel with multi-session tabs. Sessions survive panel hide/show — your shell state stays alive.',
    tag: 'xterm.js + PTY',
  },
  {
    icon: 'lucide:command',
    title: 'Command Palette',
    desc: 'Cmd+P fuzzy file search with recents first. Prefix # to search headings across the whole workspace.',
    tag: 'fuzzy · Fuse.js',
  },
  {
    icon: 'lucide:book-search',
    title: 'Workspace search',
    desc: 'Cmd+Shift+F full-text search over every .md, powered by a multi-threaded Rust backend with highlighted snippets.',
    tag: 'Rust core',
  },
  {
    icon: 'lucide:link-2',
    title: 'Wikilinks',
    desc: 'Type [[ for fuzzy autocomplete across all files. Click any relative link in preview to open it as a new tab.',
    tag: '[[]] autocomplete',
  },
  {
    icon: 'lucide:notebook-pen',
    title: 'Daily notes',
    desc: 'Alt+D creates today\u2019s YYYY-MM-DD.md with a heading template, cursor at the last line, ready to type.',
    tag: 'journaling',
  },
  {
    icon: 'lucide:waypoints',
    title: 'Graph view',
    desc: 'A D3 force-directed map of your workspace files and internal links — drag nodes, click to jump, pan & zoom.',
    tag: 'new in v1.8',
  },
]
</script>

<template>
  <section id="features">
    <div class="wrap">
      <div class="sec-head" v-reveal>
        <div class="kicker">// features</div>
        <h2>Everything around the text,<br>out of the way</h2>
        <p>An editor first, a workbench second. The tree, the preview and the terminal exist to serve one file at a time.</p>
      </div>
      <div class="feat-grid">
        <article v-for="(f, i) in features" :key="f.title" class="feat" v-reveal="(i % 3) * 80">
          <div class="ic"><Icon :icon="f.icon" width="20" height="20" /></div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.desc }}</p>
          <span class="tag">{{ f.tag }}</span>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.feat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.feat {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 24px;
  transition:
    transform 0.18s,
    border-color 0.18s,
    background 0.18s;
}

.feat:hover {
  transform: translateY(-3px);
  border-color: #4a4a4a;
  background: var(--bg-hover);
}

.feat .ic {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: rgba(0, 120, 212, 0.14);
  display: grid;
  place-items: center;
  font-size: 18px;
  margin-bottom: 14px;
}

.feat h3 {
  font-size: 15px;
  color: #fff;
  margin-bottom: 8px;
}

.feat p {
  font-size: 13.5px;
  color: var(--muted);
}

.feat .tag {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--accent-hi);
  border: 1px solid rgba(77, 170, 252, 0.35);
  border-radius: 999px;
  padding: 2px 8px;
  margin-top: 10px;
}

@media (max-width: 960px) {
  .feat-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .feat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
