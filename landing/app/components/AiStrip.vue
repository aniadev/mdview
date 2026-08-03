<script setup lang="ts">
import { Icon } from '@iconify/vue'

const agentFiles = [
  { name: 'CLAUDE.md', tag: 'agent' },
  { name: 'AGENTS.md', tag: 'agent' },
  { name: '.cursorrules', tag: 'agent' },
]
</script>

<template>
  <div class="ai-strip-wrap">
    <div class="wrap">
      <div class="ai-strip" v-reveal>
        <div class="ai-files">
          <div v-for="f in agentFiles" :key="f.name" class="ai-file">
            <span class="r"><Icon icon="lucide:bot" width="15" height="15" /></span> {{ f.name }} <span class="t">{{ f.tag }}</span>
          </div>
        </div>
        <div class="ai-body">
          <h2>Built for the AI workflow</h2>
          <p>
            mdview recognizes agent instruction files — <code>CLAUDE.md</code>, <code>AGENTS.md</code>,
            <code>.cursorrules</code> — and gives them a distinct bot icon so you always know where your
            agent&rsquo;s instructions live. Backlinks show you every note that references the active file.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-strip-wrap {
  padding-bottom: 72px;
}

.ai-strip {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 44px;
  align-items: center;
  background: linear-gradient(135deg, rgba(255, 158, 100, 0.06), rgba(255, 255, 255, 0.02) 45%);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 44px 48px;
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-md);
}

.ai-files {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 13px;
}

.ai-file {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(13, 17, 23, 0.7);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 10px 15px;
  color: #d6dde5;
  transition:
    border-color 0.3s var(--ease-out),
    transform 0.3s var(--ease-out),
    box-shadow 0.3s var(--ease-out);
}

.ai-file:hover {
  border-color: rgba(255, 158, 100, 0.55);
  transform: translateX(4px);
  box-shadow: 0 6px 20px rgba(255, 158, 100, 0.12);
}

.ai-file .r {
  color: #ff9e64;
}

.ai-file .t {
  color: var(--dim);
  margin-left: auto;
  font-size: 11px;
}

.ai-body h2 {
  font-size: 26px;
  color: #fff;
  margin-bottom: 10px;
}

.ai-body p {
  color: var(--muted);
  font-size: 14.5px;
}

@media (max-width: 960px) {
  .ai-strip {
    grid-template-columns: 1fr;
  }
}
</style>
