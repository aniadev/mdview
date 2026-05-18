<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch } from "vue";
import Sidebar from "./components/Sidebar.vue";
import TabBar from "./components/TabBar.vue";
import EditorArea from "./components/EditorArea.vue";
import CommandPalette from "./components/CommandPalette.vue";
import { useWorkspaceStore } from "./stores/workspace";
import { useTabsStore } from "./stores/tabs";
import { usePaletteStore } from "./stores/palette";
import { useThemeStore } from "./stores/theme";
import { useUiStore } from "./stores/ui";
import { checkForUpdate } from "./updater";

const workspace = useWorkspaceStore();
const tabs = useTabsStore();
const palette = usePaletteStore();
const theme = useThemeStore();
const ui = useUiStore();

const modKey =
  typeof navigator !== "undefined" && navigator.platform.includes("Mac")
    ? "⌘"
    : "Ctrl";

function onKeydown(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === "p") {
    e.preventDefault();
    if (palette.isOpen) palette.close();
    else void palette.open(workspace.rootPath);
  } else if (key === "s") {
    e.preventDefault();
    void tabs.saveActive();
  } else if (key === "w") {
    e.preventDefault();
    void tabs.closeActive();
  } else if (key === "b") {
    const inCm = (document.activeElement as HTMLElement | null)?.closest?.(".cm-editor");
    if (!inCm) {
      e.preventDefault();
      ui.toggleSidebar();
    }
  }
}

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  await theme.init();
  await workspace.restoreWorkspace();
  if (workspace.rootPath) await palette.refresh(workspace.rootPath);
  void checkForUpdate({ silent: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
});

watch(
  () => workspace.rootPath,
  async (p) => {
    if (p) await palette.refresh(p);
  }
);
</script>

<template>
  <div class="app-shell">
    <Sidebar v-show="ui.sidebarVisible" />
    <main class="main-area">
      <div v-if="workspace.error" class="error-banner">
        <span>{{ workspace.error }}</span>
        <button @click="workspace.error = null">×</button>
      </div>
      <TabBar />
      <EditorArea v-if="tabs.activeTab" />
      <div v-else class="empty-editor">
        <template v-if="workspace.hasWorkspace">
          Select a .md file from the sidebar, or press
          <kbd>{{ modKey }}+P</kbd>.
        </template>
        <template v-else>Add a folder to begin.</template>
      </div>
    </main>
    <CommandPalette />
  </div>
</template>

<style>
kbd {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  margin: 0 2px;
}
</style>
