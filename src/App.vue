<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import AppHeader from "./components/AppHeader.vue";
import Sidebar from "./components/Sidebar.vue";
import TabBar from "./components/TabBar.vue";
import EditorArea from "./components/EditorArea.vue";
import CommandPalette from "./components/CommandPalette.vue";
import BottomPanel from "./components/BottomPanel.vue";
import UpdateModal from "./components/UpdateModal.vue";
import SettingsModal from "./components/SettingsModal.vue";
import { useWorkspaceStore } from "./stores/workspace";
import { useTabsStore } from "./stores/tabs";
import { usePaletteStore } from "./stores/palette";
import { useThemeStore } from "./stores/theme";
import { useUiStore } from "./stores/ui";
import { useUpdaterStore } from "./stores/updater";

function basename(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] || p;
}

async function openExternalMd(path: string) {
  const tabs = useTabsStore();
  await tabs.openFile(path, basename(path));
}

let unlistenOpenFile: UnlistenFn | null = null;
let unlistenOpenSettings: UnlistenFn | null = null;

const workspace = useWorkspaceStore();
const tabs = useTabsStore();
const palette = usePaletteStore();
const theme = useThemeStore();
const ui = useUiStore();
const updater = useUpdaterStore();

const modKey =
  typeof navigator !== "undefined" && navigator.platform.includes("Mac")
    ? "⌘"
    : "Ctrl";

const bottomPanelEverShown = ref(ui.bottomPanelVisible);

watch(
  () => ui.bottomPanelVisible,
  (v) => {
    if (v) bottomPanelEverShown.value = true;
  }
);

function onKeydown(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === "p") {
    e.preventDefault();
    if (palette.isOpen) palette.close();
    else void palette.open(workspace.rootPaths);
  } else if (key === "s") {
    e.preventDefault();
    void tabs.saveActive();
  } else if (key === "w") {
    e.preventDefault();
    void tabs.closeActive();
  } else if (key === "b") {
    const inCm = (document.activeElement as HTMLElement | null)?.closest?.(".cm-editor");
    const inTerm = (document.activeElement as HTMLElement | null)?.closest?.(".xterm");
    if (!inCm && !inTerm) {
      e.preventDefault();
      ui.toggleSidebar();
    }
  } else if (e.key === "`") {
    e.preventDefault();
    ui.toggleBottomPanel();
  }
}

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  await theme.init();
  await workspace.restoreWorkspace();
  if (workspace.rootPaths.length > 0) await palette.refresh(workspace.rootPaths);

  unlistenOpenFile = await listen<string>("open-file-request", (e) => {
    void openExternalMd(e.payload);
  });

  unlistenOpenSettings = await listen("open-settings", () => {
    ui.openSettings();
  });

  try {
    const pending = await invoke<string[]>("consume_pending_open_files");
    for (const p of pending) await openExternalMd(p);
  } catch (e) {
    console.error("consume_pending_open_files failed", e);
  }

  // Startup update check — silent. Modal opens automatically if found.
  void updater.checkForUpdates({ silent: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  unlistenOpenFile?.();
  unlistenOpenFile = null;
  unlistenOpenSettings?.();
  unlistenOpenSettings = null;
});

watch(
  () => workspace.rootPaths.join("|"),
  async () => {
    if (workspace.rootPaths.length > 0) await palette.refresh(workspace.rootPaths);
  }
);
</script>

<template>
  <div class="app-root">
    <AppHeader />
    <div class="app-shell">
      <div class="work-area">
        <div class="work-top">
          <Sidebar v-show="ui.sidebarVisible" />
          <main class="main-area">
            <div v-if="workspace.error" class="error-banner">
              <span>{{ workspace.error }}</span>
              <button @click="workspace.error = null"><Icon icon="lucide:x" width="14" height="14" /></button>
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
        </div>
        <BottomPanel
          v-if="bottomPanelEverShown"
          v-show="ui.bottomPanelVisible"
        />
      </div>
      <CommandPalette />
      <SettingsModal />
      <UpdateModal />
      <Teleport to="body">
        <div v-if="updater.toastMessage" class="update-toast">
          {{ updater.toastMessage }}
        </div>
      </Teleport>
    </div>
  </div>
</template>

<style>
.app-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}
.app-shell {
  display: flex;
  flex: 1;
  min-height: 0;
}
.work-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.work-top {
  display: flex;
  flex: 1;
  min-height: 0;
}

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
