<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { useUiStore } from "../stores/ui";
import { useThemeStore } from "../stores/theme";

const ui = useUiStore();
const theme = useThemeStore();
</script>

<template>
  <header class="app-header">
    <div class="app-header-left"></div>
    <div class="app-header-title">mdview</div>
    <div class="app-header-right">
      <button
        class="icon-btn"
        :title="theme.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="theme.toggle()"
      >
        <Icon :icon="theme.theme === 'dark' ? 'lucide:sun' : 'lucide:moon'" width="16" height="16" />
      </button>
      <button class="icon-btn" title="Settings" @click="ui.openSettings()">
        <Icon icon="lucide:settings" width="16" height="16" />
      </button>
      <button
        class="icon-btn"
        :title="ui.sidebarVisible ? 'Hide Sidebar (Cmd/Ctrl+B)' : 'Show Sidebar (Cmd/Ctrl+B)'"
        @click="ui.toggleSidebar()"
      >
        <Icon :icon="ui.sidebarVisible ? 'lucide:panel-left-close' : 'lucide:panel-left'" width="16" height="16" />
      </button>
    </div>
  </header>
</template>

<style>
.app-header {
  display: flex;
  align-items: center;
  height: 32px;
  flex: 0 0 32px;
  background: var(--bg-tab-bar);
  border-bottom: 1px solid var(--border);
  padding: 0 8px;
  gap: 8px;
}
.app-header-left,
.app-header-right {
  display: flex;
  align-items: center;
  gap: 2px;
}
.app-header-title {
  flex: 1;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  user-select: none;
}

.icon-btn[disabled] {
  opacity: 0.6;
  cursor: default;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--text-muted);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
