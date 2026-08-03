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
      <div class="short-grid" v-reveal>
        <div v-for="s in shortcuts" :key="s.action" class="short-row">
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
  max-width: 780px;
  margin: 0 auto;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 28px 36px;
}

.short-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px dashed var(--border);
}

.short-row:last-child {
  border-bottom: none;
}

.short-row .k {
  color: var(--muted);
  font-size: 13.5px;
}

.short-row .ks {
  display: flex;
  gap: 5px;
}

@media (max-width: 640px) {
  .short-grid {
    grid-template-columns: 1fr;
    padding: 20px;
  }
}
</style>
