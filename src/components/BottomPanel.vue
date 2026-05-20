<script setup lang="ts">
import { ref, onBeforeUnmount } from "vue";
import { Icon } from "@iconify/vue";
import { useUiStore } from "../stores/ui";
import TerminalPanel from "./TerminalPanel.vue";
import { useI18n } from "../i18n";

const { t } = useI18n();

const ui = useUiStore();

const dragging = ref(false);
let startY = 0;
let startHeight = 0;

function onDragStart(e: MouseEvent) {
  e.preventDefault();
  dragging.value = true;
  startY = e.clientY;
  startHeight = ui.bottomPanelHeight;
  window.addEventListener("mousemove", onDragMove);
  window.addEventListener("mouseup", onDragEnd);
}

function onDragMove(e: MouseEvent) {
  if (!dragging.value) return;
  const delta = startY - e.clientY;
  ui.setBottomPanelHeight(startHeight + delta);
}

function onDragEnd() {
  dragging.value = false;
  window.removeEventListener("mousemove", onDragMove);
  window.removeEventListener("mouseup", onDragEnd);
}

onBeforeUnmount(() => {
  window.removeEventListener("mousemove", onDragMove);
  window.removeEventListener("mouseup", onDragEnd);
});
</script>

<template>
  <div
    class="bottom-panel"
    :style="{ height: ui.bottomPanelHeight + 'px', flexBasis: ui.bottomPanelHeight + 'px' }"
  >
    <div
      class="bottom-panel-resizer"
      :class="{ dragging }"
      @mousedown="onDragStart"
    ></div>
    <header class="bottom-panel-header">
      <span class="bottom-panel-title">TERMINAL</span>
      <button
        class="icon-btn"
        :title="t('tab.closePanel')"
        @click="ui.toggleBottomPanel()"
      >
        <Icon icon="lucide:x" width="14" height="14" />
      </button>
    </header>
    <div class="bottom-panel-body">
      <TerminalPanel />
    </div>
  </div>
</template>

<style>
.bottom-panel {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  background: var(--bg-app);
  border-top: 1px solid var(--border);
  position: relative;
  min-height: 120px;
}

.bottom-panel-resizer {
  position: absolute;
  top: -3px;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
  z-index: 5;
}

.bottom-panel-resizer:hover,
.bottom-panel-resizer.dragging {
  background: var(--accent);
  opacity: 0.4;
}

.bottom-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 4px 12px;
  height: 28px;
  flex: 0 0 28px;
  background: var(--bg-tab-bar);
  border-bottom: 1px solid var(--border);
}

.bottom-panel-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.bottom-panel-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
