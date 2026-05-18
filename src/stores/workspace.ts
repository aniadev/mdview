import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { load, Store } from "@tauri-apps/plugin-store";
import type { FsEntry, TreeNode } from "../types";

const STORE_FILE = "mdview-settings.json";
const KEY_WORKSPACE = "workspace_path";

export const useWorkspaceStore = defineStore("workspace", () => {
  const rootPath = ref<string | null>(null);
  const rootChildren = ref<TreeNode[]>([]);
  const error = ref<string | null>(null);
  const loading = ref(false);
  let store: Store | null = null;

  const hasWorkspace = computed(() => rootPath.value !== null);
  const rootName = computed(() => {
    if (!rootPath.value) return "";
    const parts = rootPath.value.split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] || rootPath.value;
  });

  const hasAnyMd = computed(() =>
    rootChildren.value.some((c) => c.has_md)
  );

  async function getStore(): Promise<Store> {
    if (!store) store = await load(STORE_FILE, { autoSave: true, defaults: {} });
    return store;
  }

  async function listDir(path: string): Promise<TreeNode[]> {
    const entries = await invoke<FsEntry[]>("list_dir", { path });
    return entries.map((e) => ({ ...e, expanded: false, loading: false }));
  }

  async function loadRoot(path: string) {
    loading.value = true;
    error.value = null;
    try {
      const children = await listDir(path);
      rootPath.value = path;
      rootChildren.value = children;
    } catch (e) {
      error.value = String(e);
      rootPath.value = null;
      rootChildren.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function addWorkspace() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select workspace folder",
    });
    if (!selected || typeof selected !== "string") return;
    await loadRoot(selected);
    const s = await getStore();
    await s.set(KEY_WORKSPACE, selected);
    await s.save();
  }

  async function removeWorkspace() {
    rootPath.value = null;
    rootChildren.value = [];
    error.value = null;
    const s = await getStore();
    await s.delete(KEY_WORKSPACE);
    await s.save();
  }

  async function restoreWorkspace() {
    const s = await getStore();
    const saved = await s.get<string>(KEY_WORKSPACE);
    if (!saved) return;
    const exists = await invoke<boolean>("path_exists", { path: saved });
    if (!exists) {
      error.value = `Workspace folder not found: ${saved}`;
      return;
    }
    await loadRoot(saved);
  }

  async function toggleDir(node: TreeNode) {
    if (!node.is_dir) return;
    if (node.expanded) {
      node.expanded = false;
      return;
    }
    if (!node.children) {
      node.loading = true;
      try {
        node.children = await listDir(node.path);
      } catch (e) {
        error.value = String(e);
      } finally {
        node.loading = false;
      }
    }
    node.expanded = true;
  }

  return {
    rootPath,
    rootChildren,
    error,
    loading,
    hasWorkspace,
    rootName,
    hasAnyMd,
    addWorkspace,
    removeWorkspace,
    restoreWorkspace,
    toggleDir,
  };
});
