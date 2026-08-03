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
  <section id="features" class="glow-top">
    <div class="wrap">
      <div class="sec-head" v-reveal>
        <div class="kicker">// features</div>
        <h2>Everything around the text,<br>out of the way</h2>
        <p>An editor first, a workbench second. The tree, the preview and the terminal exist to serve one file at a time.</p>
      </div>
      <div class="feat-grid">
        <article
          v-for="(f, i) in features"
          :key="f.title"
          class="feat"
          v-spotlight
          v-reveal="{ delay: (i % 3) * 90, variant: 'scale' }"
        >
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
  gap: 18px;
}

.feat {
  position: relative;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.015));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 26px;
  overflow: hidden;
  isolation: isolate;
  backdrop-filter: blur(10px);
  transition:
    transform 0.35s var(--ease-out),
    border-color 0.35s var(--ease-out),
    box-shadow 0.35s var(--ease-out);
}

/* cursor spotlight (driven by v-spotlight → --mx/--my/--spot-opacity) */
.feat::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    280px circle at var(--mx, 50%) var(--my, 50%),
    rgba(0, 120, 212, 0.16),
    transparent 65%
  );
  opacity: var(--spot-opacity, 0);
  transition: opacity 0.35s var(--ease-out);
  pointer-events: none;
  z-index: -1;
}

/* top hairline that lights up on hover */
.feat::after {
  content: '';
  position: absolute;
  top: 0;
  left: 12%;
  right: 12%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent-hi), transparent);
  opacity: 0;
  transition: opacity 0.35s var(--ease-out);
  pointer-events: none;
}

.feat:hover {
  transform: translateY(-5px);
  border-color: rgba(77, 170, 252, 0.34);
  box-shadow: var(--shadow-md), var(--shadow-glow);
}

.feat:hover::after {
  opacity: 1;
}

.feat .ic {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  background: linear-gradient(150deg, rgba(0, 120, 212, 0.25), rgba(0, 120, 212, 0.08));
  border: 1px solid rgba(77, 170, 252, 0.18);
  color: var(--accent-hi);
  display: grid;
  place-items: center;
  margin-bottom: 16px;
  transition:
    transform 0.4s var(--ease-spring),
    box-shadow 0.4s var(--ease-out);
}

.feat:hover .ic {
  transform: translateY(-2px) scale(1.08) rotate(-4deg);
  box-shadow: 0 6px 20px rgba(0, 120, 212, 0.3);
}

.feat h3 {
  font-size: 15.5px;
  color: #fff;
  margin-bottom: 8px;
  letter-spacing: -0.2px;
}

.feat p {
  font-size: 13.5px;
  color: var(--muted);
  line-height: 1.65;
}

.feat .tag {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--accent-hi);
  border: 1px solid rgba(77, 170, 252, 0.28);
  background: rgba(0, 120, 212, 0.08);
  border-radius: 999px;
  padding: 2.5px 9px;
  margin-top: 12px;
  transition:
    background 0.3s var(--ease-out),
    border-color 0.3s var(--ease-out);
}

.feat:hover .tag {
  background: rgba(0, 120, 212, 0.16);
  border-color: rgba(77, 170, 252, 0.5);
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
