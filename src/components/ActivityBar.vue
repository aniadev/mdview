<script setup lang="ts">
import { useUiStore } from "../stores/ui";

const ui = useUiStore();
</script>

<template>
  <nav class="activity-bar">
    <button
      class="activity-btn"
      :class="{ active: ui.sidebarVisible }"
      title="Folders (Cmd/Ctrl+B)"
      @click="ui.toggleSidebar()"
    >
      <span class="activity-icon">📁</span>
    </button>
    <button
      class="activity-btn"
      :class="{ active: ui.bottomPanelVisible }"
      title="Terminal (Cmd/Ctrl+`)"
      @click="ui.toggleBottomPanel()"
    >
      <span class="activity-icon">▶_</span>
    </button>
  </nav>
</template>

<style>
.activity-bar {
  width: 48px;
  flex: 0 0 48px;
  background: var(--bg-tab-bar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 4px 0;
}

.activity-btn {
  height: 48px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  position: relative;
  border-radius: 0;
  padding: 0;
}

.activity-btn:hover {
  color: var(--text);
  background: transparent;
}

.activity-btn.active {
  color: var(--text);
}

.activity-btn.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--accent);
}

.activity-icon {
  font-family: var(--font-mono);
  font-size: 18px;
  line-height: 1;
}
</style>
