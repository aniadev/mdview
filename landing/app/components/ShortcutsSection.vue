<script setup lang="ts">
interface Shortcut {
  action: string
  keys: string[]
}

const shortcuts: Shortcut[] = [
  { action: 'Save', keys: ['⌘', 'S'] },
  { action: 'Command Palette', keys: ['⌘', 'P'] },
  { action: 'Workspace search', keys: ['⌘', '⇧', 'F'] },
  { action: 'Toggle sidebar', keys: ['⌘', 'B'] },
  { action: 'Toggle terminal', keys: ['⌘', 'J'] },
  { action: 'Find in editor', keys: ['⌘', 'F'] },
  { action: 'Daily note', keys: ['⌥', 'D'] },
  { action: 'Settings (macOS)', keys: ['⌘', ','] },
]
</script>

<template>
  <section id="shortcuts">
    <div class="wrap">
      <div class="sec-head" v-reveal>
        <div class="kicker">// shortcuts</div>
        <h2>Keyboard-first, like a real editor</h2>
        <p>Every frequent action is one chord away. macOS and Windows/Linux maps both supported.</p>
      </div>
      <div class="short-grid" v-reveal="{ variant: 'scale' }">
        <div v-for="(s, i) in shortcuts" :key="s.action" class="short-row" :style="{ '--i': i }">
          <span class="k">{{ s.action }}</span>
          <span class="ks">
            <kbd v-for="key in s.keys" :key="key">{{ key }}</kbd>
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.short-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 48px;
  max-width: 800px;
  margin: 0 auto;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.012));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px 40px;
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-md);
}

.short-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 11px 10px;
  margin: 0 -10px;
  border-bottom: 1px dashed var(--border);
  border-radius: 8px;
  transition: background 0.25s var(--ease-out);
}

.short-row:hover {
  background: rgba(255, 255, 255, 0.04);
}

.short-row:nth-last-child(-n + 2) {
  border-bottom: none;
}

.short-row .k {
  color: var(--muted);
  font-size: 13.5px;
  transition: color 0.25s var(--ease-out);
}

.short-row:hover .k {
  color: var(--text);
}

.short-row .ks {
  display: flex;
  gap: 5px;
}

.short-row :deep(kbd) {
  transition:
    transform 0.25s var(--ease-spring),
    border-color 0.25s var(--ease-out),
    color 0.25s var(--ease-out);
}

.short-row:hover :deep(kbd) {
  transform: translateY(-2px);
  border-color: rgba(77, 170, 252, 0.5);
  color: #fff;
}

@media (max-width: 640px) {
  .short-grid {
    grid-template-columns: 1fr;
    padding: 22px;
  }
  .short-row:nth-last-child(-n + 2) {
    border-bottom: 1px dashed var(--border);
  }
  .short-row:last-child {
    border-bottom: none;
  }
}
</style>
