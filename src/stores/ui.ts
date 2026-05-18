import { defineStore } from "pinia";
import { ref } from "vue";

export const useUiStore = defineStore("ui", () => {
  const sidebarVisible = ref(true);
  const bottomPanelVisible = ref(false);
  const bottomPanelHeight = ref(280);

  function toggleSidebar() {
    sidebarVisible.value = !sidebarVisible.value;
  }

  function toggleBottomPanel() {
    bottomPanelVisible.value = !bottomPanelVisible.value;
  }

  function setBottomPanelHeight(h: number) {
    bottomPanelHeight.value = Math.max(120, Math.min(800, h));
  }

  return {
    sidebarVisible,
    bottomPanelVisible,
    bottomPanelHeight,
    toggleSidebar,
    toggleBottomPanel,
    setBottomPanelHeight,
  };
});
