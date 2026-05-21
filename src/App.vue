<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Icon } from "@iconify/vue";
import Sidebar from "./components/Sidebar.vue";
import TabBar from "./components/TabBar.vue";
import EditorArea from "./components/EditorArea.vue";
import CommandPalette from "./components/CommandPalette.vue";
import BottomPanel from "./components/BottomPanel.vue";
import UpdateModal from "./components/UpdateModal.vue";
import SettingsModal from "./components/SettingsModal.vue";
import TourOverlay from "./components/TourOverlay.vue";
import { useWorkspaceStore } from "./stores/workspace";
import { useTabsStore } from "./stores/tabs";
import { usePaletteStore } from "./stores/palette";
import { useThemeStore } from "./stores/theme";
import { useUiStore } from "./stores/ui";
import { useUpdaterStore } from "./stores/updater";
import { useI18n } from "./i18n";

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
const { t, initLocale } = useI18n();

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
  if (e.altKey && e.key.toLowerCase() === "d") {
    e.preventDefault();
    void workspace.openDailyNote();
    return;
  }

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
  } else if (e.key === "`" || key === "j") {
    e.preventDefault();
    ui.toggleBottomPanel();
  }
}

onMounted(async () => {
  await initLocale();
  window.addEventListener("keydown", onKeydown);
  await theme.init();
  await workspace.restoreWorkspace();
  if (workspace.rootPaths.length > 0) await palette.refresh(workspace.rootPaths);
  // Start tour on first launch (checks tour_seen flag internally)
  void ui.initTour();

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
  <!-- app-root -->
  <div class="flex flex-col h-full w-full">
    <!-- app-shell -->
    <div class="flex flex-1 min-h-0">
      <!-- work-area -->
      <div class="flex flex-col flex-1 min-w-0 min-h-0">
        <!-- work-top -->
        <div class="flex flex-1 min-h-0">
          <Sidebar v-show="ui.sidebarVisible" />
          <!-- main-area -->
          <main class="flex-1 flex flex-col bg-[var(--bg-app)] overflow-hidden">
            <!-- error-banner -->
            <div
              v-if="workspace.error"
              class="bg-[#5a1d1d] text-[var(--text)] px-3 py-2 text-xs border-b border-[var(--border)] flex justify-between items-center gap-2"
            >
              <span>{{ workspace.error }}</span>
              <button
                class="border-none bg-transparent text-[var(--text)] cursor-pointer text-sm px-1 py-0 hover:bg-transparent"
                @click="workspace.error = null"
              >
                <Icon icon="lucide:x" width="14" height="14" />
              </button>
            </div>
            <TabBar />
            <EditorArea v-if="tabs.activeTab" />
            <!-- empty-editor -->
            <div v-else class="flex-1 flex items-center justify-center text-[var(--text-muted)] text-[13px]">
              <template v-if="workspace.hasWorkspace">
                {{ t('app.empty.selectFile').replace('{key}', modKey) }}
              </template>
              <template v-else>{{ t('app.empty.noWorkspace') }}</template>
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
      <TourOverlay v-if="ui.tourActive" />
      <Teleport to="body">
        <div v-if="updater.toastMessage" class="update-toast">
          {{ updater.toastMessage }}
        </div>
        <div v-if="ui.toastMessage" class="app-toast">
          {{ ui.toastMessage }}
        </div>
      </Teleport>
    </div>
  </div>
</template>

<style>
/* app-toast is a Teleport target — must stay unscoped */
.app-toast {
  position: fixed;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 7px 16px;
  border-radius: 4px;
  font-size: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  z-index: 300;
  animation: toast-slide-up 0.18s ease-out;
  white-space: nowrap;
}

@keyframes toast-slide-up {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
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
