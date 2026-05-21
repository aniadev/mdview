import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useI18n } from "../i18n";

export interface Tab {
  path: string;
  name: string;
  content: string;
  savedContent: string;
  loading: boolean;
  loadError: string | null;
}

export const useTabsStore = defineStore("tabs", () => {
  const tabs = ref<Tab[]>([]);
  const activePath = ref<string | null>(null);
  const recentPaths = ref<string[]>([]);

  const activeTab = computed(() =>
    tabs.value.find((t) => t.path === activePath.value) ?? null
  );

  function isDirty(tab: Tab): boolean {
    return tab.content !== tab.savedContent;
  }

  const activeDirty = computed(() =>
    activeTab.value ? isDirty(activeTab.value) : false
  );

  async function openFile(path: string, name: string) {
    const rIdx = recentPaths.value.indexOf(path);
    if (rIdx !== -1) recentPaths.value.splice(rIdx, 1);
    recentPaths.value.unshift(path);
    if (recentPaths.value.length > 20) recentPaths.value.pop();

    const existing = tabs.value.find((t) => t.path === path);
    if (existing) {
      activePath.value = path;
      return;
    }
    tabs.value.push({
      path,
      name,
      content: "",
      savedContent: "",
      loading: true,
      loadError: null,
    });
    activePath.value = path;
    try {
      const text = await invoke<string>("read_text", { path });
      const stored = tabs.value.find((t) => t.path === path);
      if (!stored) return;
      stored.content = text;
      stored.savedContent = text;
      stored.loading = false;
    } catch (e) {
      const stored = tabs.value.find((t) => t.path === path);
      if (!stored) return;
      stored.loadError = String(e);
      stored.loading = false;
    }
  }

  function setContent(path: string, content: string) {
    const tab = tabs.value.find((t) => t.path === path);
    if (tab) tab.content = content;
  }

  async function saveTab(path: string): Promise<boolean> {
    const tab = tabs.value.find((t) => t.path === path);
    if (!tab || tab.loading || tab.loadError) return false;
    if (!isDirty(tab)) return true;
    try {
      await invoke("write_text", { path: tab.path, contents: tab.content });
      tab.savedContent = tab.content;
      return true;
    } catch (e) {
      console.error("save failed", e);
      return false;
    }
  }

  async function saveActive(): Promise<boolean> {
    if (!activePath.value) return false;
    return saveTab(activePath.value);
  }

  async function closeTab(path: string): Promise<void> {
    const { t } = useI18n();
    const idx = tabs.value.findIndex((t) => t.path === path);
    if (idx === -1) return;
    const tab = tabs.value[idx];
    if (isDirty(tab)) {
      const ok = await confirm(
        t('confirm.unsavedMsg', { name: tab.name }),
        { title: t('confirm.unsavedTitle'), kind: "warning" }
      );
      if (!ok) return;
    }
    tabs.value.splice(idx, 1);
    if (activePath.value === path) {
      const next = tabs.value[idx] ?? tabs.value[idx - 1] ?? null;
      activePath.value = next ? next.path : null;
    }
  }

  function setActive(path: string) {
    activePath.value = path;
  }

  async function closeActive() {
    if (activePath.value) await closeTab(activePath.value);
  }

  function handleFileRenamed(oldPath: string, newPath: string, newName: string) {
    const tab = tabs.value.find((t) => t.path === oldPath);
    if (!tab) return;
    tab.path = newPath;
    tab.name = newName;
    if (activePath.value === oldPath) activePath.value = newPath;
  }

  function handleFileDeleted(path: string) {
    const idx = tabs.value.findIndex((t) => t.path === path);
    if (idx === -1) return;
    tabs.value.splice(idx, 1);
    if (activePath.value === path) {
      const next = tabs.value[idx] ?? tabs.value[idx - 1] ?? null;
      activePath.value = next ? next.path : null;
    }
  }

  function moveTab(fromIndex: number, toIndex: number) {
    const [moved] = tabs.value.splice(fromIndex, 1);
    tabs.value.splice(toIndex, 0, moved);
  }

  async function closeAllTabs(): Promise<void> {
    const { t } = useI18n();
    const dirty = tabs.value.filter(isDirty);
    if (dirty.length > 0) {
      const ok = await confirm(
        t('confirm.closeAllMsg', { n: dirty.length }),
        { title: t('confirm.closeAllTitle'), kind: "warning" }
      );
      if (!ok) return;
    }
    tabs.value = [];
    activePath.value = null;
  }

  return {
    tabs,
    activePath,
    activeTab,
    recentPaths,
    activeDirty,
    isDirty,
    openFile,
    setContent,
    saveTab,
    saveActive,
    closeTab,
    closeActive,
    closeAllTabs,
    setActive,
    handleFileRenamed,
    handleFileDeleted,
    moveTab,
  };
});
