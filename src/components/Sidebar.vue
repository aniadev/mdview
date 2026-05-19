<script setup lang="ts">
import { ref, onBeforeUnmount } from "vue";
import { useUiStore } from "../stores/ui";
import ExplorerPanel from "./ExplorerPanel.vue";

const ui = useUiStore();
const dragging = ref(false);
let startX = 0;
let startWidth = 0;

function onDragStart(e: MouseEvent) {
  e.preventDefault();
  dragging.value = true;
  startX = e.clientX;
  startWidth = ui.sidebarWidth;
  window.addEventListener("mousemove", onDragMove);
  window.addEventListener("mouseup", onDragEnd);
}

function onDragMove(e: MouseEvent) {
  if (!dragging.value) return;
  const delta = e.clientX - startX;
  ui.setSidebarWidth(startWidth + delta);
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
  <aside
    class="sidebar"
    :style="{ width: ui.sidebarWidth + 'px', flexBasis: ui.sidebarWidth + 'px' }"
  >
    <ExplorerPanel />
    <div
      class="sidebar-resize-handle"
      :class="{ dragging }"
      @mousedown="onDragStart"
    ></div>
  </aside>
</template>

<style>
.sidebar {
  position: relative;
  flex: 0 0 auto;
}

.sidebar-resize-handle {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 5;
}

.sidebar-resize-handle:hover,
.sidebar-resize-handle.dragging {
  background: var(--accent);
  opacity: 0.4;
}
</style>
