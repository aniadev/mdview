<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { usePaletteStore } from "../stores/palette";
import { useTabsStore } from "../stores/tabs";
import { useI18n } from "../i18n";

const { t } = useI18n();

const palette = usePaletteStore();
const tabs = useTabsStore();

const input = ref<HTMLInputElement | null>(null);

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
    palette.moveSelection(1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    palette.moveSelection(-1);
  } else if (e.key === "Enter") {
    e.preventDefault();
    pick(palette.selectedIndex);
  }
}

function pick(idx: number) {
  const item = palette.results[idx];
  if (!item) return;
  tabs.openFile(item.path, item.name);
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
      <ul class="palette-results" v-if="palette.results.length > 0">
        <li
          v-for="(r, i) in palette.results"
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
