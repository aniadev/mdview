import { defineStore } from "pinia";
import { ref } from "vue";
import type { TocHeading } from "../components/TocPanel.vue";

export type SidebarView = "explorer" | "outline";

export const useUiStore = defineStore("ui", () => {
  const sidebarVisible = ref(true);
  const sidebarWidth = ref(220);
  const bottomPanelVisible = ref(false);
  const bottomPanelHeight = ref(280);
  const settingsOpen = ref(false);
  const sidebarView = ref<SidebarView>("explorer");
  const currentHeadings = ref<TocHeading[]>([]);
  const activeHeadingIndex = ref(-1);
  const navigateHeadingTrigger = ref(0);

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

  function setSidebarView(view: SidebarView) {
    sidebarView.value = view;
  }

  function setCurrentHeadings(headings: TocHeading[]) {
    currentHeadings.value = headings;
  }

  function setActiveHeadingIndex(index: number) {
    activeHeadingIndex.value = index;
  }

  function triggerNavigateHeading(index: number) {
    activeHeadingIndex.value = index;
    navigateHeadingTrigger.value++;
  }

  return {
    sidebarVisible,
    sidebarWidth,
    bottomPanelVisible,
    bottomPanelHeight,
    settingsOpen,
    sidebarView,
    currentHeadings,
    activeHeadingIndex,
    navigateHeadingTrigger,
    toggleSidebar,
    toggleBottomPanel,
    setBottomPanelHeight,
    setSidebarWidth,
    openSettings,
    closeSettings,
    setSidebarView,
    setCurrentHeadings,
    setActiveHeadingIndex,
    triggerNavigateHeading,
  };
});
