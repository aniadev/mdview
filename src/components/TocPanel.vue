<script setup lang="ts">

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

const props = defineProps<{
  headings: TocHeading[];
  activeIndex: number;
}>();

const emit = defineEmits<{
  (e: "navigate", index: number): void;
}>();

const indentMap: Record<number, string> = { 1: "0", 2: "12px", 3: "24px", 4: "36px", 5: "48px", 6: "60px" };

function headingClass(level: number, index: number) {
  return {
    "toc-item": true,
    "toc-active": index === props.activeIndex,
    "toc-h1": level === 1,
    "toc-h2": level === 2,
    "toc-hdeep": level >= 3,
  };
}
</script>

<template>
  <div class="toc-panel">
    <div v-if="headings.length === 0" class="toc-empty">
      No headings found in this document.
    </div>
    <button
      v-for="(h, i) in headings"
      :key="h.id"
      :class="headingClass(h.level, i)"
      :style="{ paddingLeft: indentMap[h.level] || '0' }"
      @click="emit('navigate', i)"
    >
      {{ h.text }}
    </button>
  </div>
</template>

<style>
.toc-panel {
  overflow-y: auto;
  padding: 4px 0;
}

.toc-empty {
  padding: 16px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}

.toc-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 3px 12px;
  background: transparent;
  border: none;
  border-radius: 0;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 20px;
}

.toc-item:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.toc-item.toc-active {
  background: var(--bg-selected);
  color: var(--text);
}

.toc-item.toc-h1 {
  font-weight: 600;
  color: var(--text);
}

.toc-item.toc-h2 {
  color: var(--text);
}

.toc-item.toc-hdeep {
  color: var(--text-muted);
  font-size: 11px;
}
</style>
