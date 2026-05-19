import { defineStore } from "pinia";
import { ref } from "vue";

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
    openContextMenu,
    closeContextMenu,
    requestCreateIn,
    requestCreateDirIn,
    requestRename,
    cancelInputs,
  };
});
