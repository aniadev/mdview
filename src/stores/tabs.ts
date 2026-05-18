import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";

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
    const idx = tabs.value.findIndex((t) => t.path === path);
    if (idx === -1) return;
    const tab = tabs.value[idx];
    if (isDirty(tab)) {
      const ok = await confirm(
        `"${tab.name}" has unsaved changes. Close without saving?`,
        { title: "Unsaved changes", kind: "warning" }
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

  async function closeAllTabs(): Promise<void> {
    const dirty = tabs.value.filter(isDirty);
    if (dirty.length > 0) {
      const ok = await confirm(
        `${dirty.length} file${dirty.length > 1 ? "s have" : " has"} unsaved changes. Close all without saving?`,
        { title: "Close all tabs", kind: "warning" }
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
  };
});
