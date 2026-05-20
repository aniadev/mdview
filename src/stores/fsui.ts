import { defineStore } from "pinia";
import { ref, computed } from "vue";

interface CtxMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetPath: string;
  isDir: boolean;
  isMdFile: boolean;
}

export const useFsUiStore = defineStore("fsui", () => {
  const pendingCreateInDir = ref<string | null>(null);
  const pendingCreateDirInDir = ref<string | null>(null);
  const pendingRenamePath = ref<string | null>(null);
  const ctxMenu = ref<CtxMenuState>({
    visible: false,
    x: 0,
    y: 0,
    targetPath: "",
    isDir: false,
    isMdFile: false,
  });

  // Multi-select state: path → isDir
  const selectedItems = ref<Map<string, boolean>>(new Map());
  const selectedCount = computed(() => selectedItems.value.size);

  function toggleSelection(path: string, isDir: boolean) {
    const next = new Map(selectedItems.value);
    if (next.has(path)) next.delete(path);
    else next.set(path, isDir);
    selectedItems.value = next;
  }

  function selectOne(path: string, isDir: boolean) {
    selectedItems.value = new Map([[path, isDir]]);
  }

  function clearSelection() {
    selectedItems.value = new Map();
  }

  function isMultiSelected(path: string): boolean {
    return selectedItems.value.has(path);
  }

  // Clipboard state — multi-file
  const clipSources = ref<string[]>([]);
  const clipIsDirs = ref<boolean[]>([]);
  const clipOp = ref<'copy' | 'cut' | null>(null);
  const hasClipboard = computed(() => clipSources.value.length > 0);

  function setClipboardMulti(paths: string[], isDirs: boolean[], op: 'copy' | 'cut') {
    clipSources.value = paths;
    clipIsDirs.value = isDirs;
    clipOp.value = op;
  }

  function setClipboard(path: string, isDir: boolean, op: 'copy' | 'cut') {
    setClipboardMulti([path], [isDir], op);
  }

  function clearClipboard() {
    clipSources.value = [];
    clipIsDirs.value = [];
    clipOp.value = null;
  }

  function openContextMenu(
    e: MouseEvent,
    target: { path: string; is_dir: boolean; has_md: boolean }
  ) {
    ctxMenu.value = {
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetPath: target.path,
      isDir: target.is_dir,
      isMdFile: !target.is_dir && target.has_md,
    };
  }

  function closeContextMenu() {
    ctxMenu.value.visible = false;
  }

  function requestCreateIn(dir: string) {
    pendingCreateInDir.value = dir;
    pendingCreateDirInDir.value = null;
    pendingRenamePath.value = null;
  }

  function requestCreateDirIn(dir: string) {
    pendingCreateDirInDir.value = dir;
    pendingCreateInDir.value = null;
    pendingRenamePath.value = null;
  }

  function requestRename(path: string) {
    pendingRenamePath.value = path;
    pendingCreateInDir.value = null;
    pendingCreateDirInDir.value = null;
  }

  function cancelInputs() {
    pendingCreateInDir.value = null;
    pendingCreateDirInDir.value = null;
    pendingRenamePath.value = null;
  }

  return {
    pendingCreateInDir,
    pendingCreateDirInDir,
    pendingRenamePath,
    ctxMenu,
    selectedItems,
    selectedCount,
    toggleSelection,
    selectOne,
    clearSelection,
    isMultiSelected,
    clipSources,
    clipIsDirs,
    clipOp,
    hasClipboard,
    setClipboardMulti,
    setClipboard,
    clearClipboard,
    openContextMenu,
    closeContextMenu,
    requestCreateIn,
    requestCreateDirIn,
    requestRename,
    cancelInputs,
  };
});
