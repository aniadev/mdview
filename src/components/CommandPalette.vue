<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { usePaletteStore, type MdFile } from "../stores/palette";
import { useTabsStore } from "../stores/tabs";
import { useI18n } from "../i18n";

const { t } = useI18n();

const palette = usePaletteStore();
const tabs = useTabsStore();

const input = ref<HTMLInputElement | null>(null);

interface HeadingHit {
  fileName: string;
  filePath: string;
  headingText: string;
  level: number;
}

const recentItems = computed<MdFile[]>(() => {
  if (palette.isHeadingMode || palette.query.trim()) return [];
  return tabs.recentPaths
    .slice(0, 5)
    .map((p) => palette.files.find((f) => f.path === p))
    .filter((f): f is MdFile => f !== undefined);
});

const headingItems = computed<HeadingHit[]>(() => {
  if (!palette.isHeadingMode) return [];
  const q = palette.query.trimStart().slice(1).trim().toLowerCase();
  const hits: HeadingHit[] = [];
  const re = /^(#{1,6})\s+(.+)/gm;
  for (const tab of tabs.tabs) {
    if (!tab.content) continue;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(tab.content)) !== null) {
      const text = m[2].trim();
      if (!q || text.toLowerCase().includes(q)) {
        hits.push({ fileName: tab.name, filePath: tab.path, headingText: text, level: m[1].length });
      }
    }
  }
  return hits;
});

const activeItems = computed<MdFile[] | HeadingHit[]>(() => {
  if (palette.isHeadingMode) return headingItems.value;
  if (!palette.query.trim() && recentItems.value.length > 0) return recentItems.value;
  return palette.results;
});

const showRecent = computed(
  () => !palette.isHeadingMode && !palette.query.trim() && recentItems.value.length > 0
);

watch(
  () => palette.isOpen,
  async (open) => {
    if (open) {
      await nextTick();
      input.value?.focus();
      input.value?.select();
    }
  }
);

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    palette.close();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    palette.moveSelection(1, activeItems.value.length);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    palette.moveSelection(-1, activeItems.value.length);
  } else if (e.key === "Enter") {
    e.preventDefault();
    pick(palette.selectedIndex);
  }
}

function pick(idx: number) {
  if (palette.isHeadingMode) {
    const item = (activeItems.value as HeadingHit[])[idx];
    if (!item) return;
    tabs.openFile(item.filePath, item.fileName);
  } else {
    const item = (activeItems.value as MdFile[])[idx];
    if (!item) return;
    tabs.openFile(item.path, item.name);
  }
  palette.close();
}

function onInput(e: Event) {
  palette.setQuery((e.target as HTMLInputElement).value);
}

function onBackdropClick() {
  palette.close();
}
</script>

<template>
  <div v-if="palette.isOpen" class="palette-overlay" @click="onBackdropClick">
    <div class="palette" @click.stop>
      <input
        ref="input"
        class="palette-input"
        :value="palette.query"
        @input="onInput"
        @keydown="onKeydown"
        :placeholder="t('palette.placeholder')"
        spellcheck="false"
      />

      <!-- Heading mode -->
      <template v-if="palette.isHeadingMode">
        <div class="palette-section-label">{{ t('palette.headings') }}</div>
        <ul v-if="headingItems.length > 0" class="palette-results">
          <li
            v-for="(r, i) in headingItems"
            :key="r.filePath + r.headingText + i"
            class="palette-item"
            :class="{ selected: i === palette.selectedIndex }"
            @click="pick(i)"
            @mouseenter="palette.selectedIndex = i"
          >
            <span class="palette-name">{{ r.headingText }}</span>
            <span class="palette-path">{{ r.fileName }}</span>
          </li>
        </ul>
        <div v-else class="palette-empty">{{ t('palette.noHeadings') }}</div>
      </template>

      <!-- Recent / normal mode -->
      <template v-else>
        <div v-if="showRecent" class="palette-section-label">{{ t('palette.recent') }}</div>
        <ul v-if="(activeItems as MdFile[]).length > 0" class="palette-results">
          <li
            v-for="(r, i) in (activeItems as MdFile[])"
            :key="r.path"
            class="palette-item"
            :class="{ selected: i === palette.selectedIndex }"
            @click="pick(i)"
            @mouseenter="palette.selectedIndex = i"
          >
            <span class="palette-name">{{ r.name }}</span>
            <span class="palette-path">{{ r.rel_path }}</span>
          </li>
        </ul>
        <div v-else class="palette-empty">{{ t('palette.noMatches') }}</div>
      </template>
    </div>
  </div>
</template>

<style>
.palette-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 80px;
  z-index: 100;
}

.palette {
  width: 560px;
  max-width: calc(100% - 32px);
  max-height: 60vh;
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.palette-input {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-app);
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 14px;
  outline: none;
}

.palette-section-label {
  padding: 4px 14px 2px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}

.palette-results {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  max-height: 400px;
}

.palette-item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 13px;
}

.palette-item.selected {
  background: var(--bg-selected);
}

.palette-name {
  color: var(--text);
  flex: 0 0 auto;
}

.palette-path {
  color: var(--text-muted);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.palette-empty {
  padding: 14px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
