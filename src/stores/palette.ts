import { defineStore } from "pinia";
import { ref, computed } from "vue";
import Fuse from "fuse.js";
import { invoke } from "@tauri-apps/api/core";

export interface MdFile {
  name: string;
  path: string;
  rel_path: string;
}

export const usePaletteStore = defineStore("palette", () => {
  const isOpen = ref(false);
  const query = ref("");
  const selectedIndex = ref(0);
  const files = ref<MdFile[]>([]);
  let fuse: Fuse<MdFile> | null = null;

  function rebuildIndex() {
    fuse = new Fuse(files.value, {
      keys: [
        { name: "name", weight: 0.7 },
        { name: "rel_path", weight: 0.3 },
      ],
      threshold: 0.4,
      ignoreLocation: true,
    });
  }

  async function refresh(rootPaths: string[]) {
    if (!rootPaths || rootPaths.length === 0) {
      files.value = [];
      fuse = null;
      return;
    }
    try {
      const all: MdFile[] = [];
      const seen = new Set<string>();
      for (const root of rootPaths) {
        try {
          const list = await invoke<MdFile[]>("list_md_files", { root });
          for (const f of list) {
            if (seen.has(f.path)) continue;
            seen.add(f.path);
            all.push(f);
          }
        } catch (e) {
          console.error("list_md_files failed for", root, e);
        }
      }
      all.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      files.value = all;
      rebuildIndex();
    } catch (e) {
      console.error("palette refresh failed", e);
      files.value = [];
      fuse = null;
    }
  }

  const results = computed<MdFile[]>(() => {
    const q = query.value.trim();
    if (!q) return files.value.slice(0, 20);
    if (!fuse) return [];
    return fuse.search(q, { limit: 20 }).map((r) => r.item);
  });

  async function open(rootPaths: string[]) {
    if (rootPaths.length > 0) await refresh(rootPaths);
    query.value = "";
    selectedIndex.value = 0;
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  function moveSelection(delta: number) {
    const max = results.value.length;
    if (max === 0) return;
    selectedIndex.value = (selectedIndex.value + delta + max) % max;
  }

  function setQuery(v: string) {
    query.value = v;
    selectedIndex.value = 0;
  }

  return {
    isOpen,
    query,
    selectedIndex,
    results,
    open,
    close,
    moveSelection,
    setQuery,
    refresh,
  };
});
