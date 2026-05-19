import { defineStore } from "pinia";
import { ref } from "vue";

export const useUiStore = defineStore("ui", () => {
  const sidebarVisible = ref(true);
  const sidebarWidth = ref(220);
  const bottomPanelVisible = ref(false);
  const bottomPanelHeight = ref(280);
  const settingsOpen = ref(false);

  function toggleSidebar() {
    sidebarVisible.value = !sidebarVisible.value;
  }

  function toggleBottomPanel() {
    bottomPanelVisible.value = !bottomPanelVisible.value;
  }

  function setBottomPanelHeight(h: number) {
    bottomPanelHeight.value = Math.max(120, Math.min(800, h));
  }

  function setSidebarWidth(w: number) {
    sidebarWidth.value = Math.max(140, Math.min(480, w));
  }

  function openSettings() {
    settingsOpen.value = true;
  }

  function closeSettings() {
    settingsOpen.value = false;
  }

  return {
    sidebarVisible,
    sidebarWidth,
    bottomPanelVisible,
    bottomPanelHeight,
    settingsOpen,
    toggleSidebar,
    toggleBottomPanel,
    setBottomPanelHeight,
    setSidebarWidth,
    openSettings,
    closeSettings,
  };
});
