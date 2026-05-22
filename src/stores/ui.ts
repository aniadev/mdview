import { defineStore } from "pinia";
import { ref } from "vue";
import { load } from "@tauri-apps/plugin-store";
import type { TocHeading } from "../components/TocPanel.vue";

export type SidebarView = "explorer" | "outline" | "search" | "graph";

export const useUiStore = defineStore("ui", () => {
  const sidebarVisible = ref(true);
  const sidebarWidth = ref(220);
  const bottomPanelVisible = ref(false);
  const bottomPanelHeight = ref(280);
  const settingsOpen = ref(false);
  const sidebarView = ref<SidebarView>("explorer");
  const targetLine = ref<number | null>(null);
  const currentHeadings = ref<TocHeading[]>([]);
  const activeHeadingIndex = ref(-1);
  const navigateHeadingTrigger = ref(0);

  // Toast state
  const toastMessage = ref<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function showToast(msg: string, ms = 2200) {
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastMessage.value = msg;
    toastTimer = setTimeout(() => {
      toastMessage.value = null;
      toastTimer = null;
    }, ms);
  }

  // Tour state
  const tourActive = ref(false);
  const tourStep = ref(0);
  const tourSeen = ref(false);
  const TOUR_STEPS_COUNT = 9;

  function toggleSidebar() {
    sidebarVisible.value = !sidebarVisible.value;
  }

  function toggleBottomPanel() {
    bottomPanelVisible.value = !bottomPanelVisible.value;
  }

  function showBottomPanel() {
    bottomPanelVisible.value = true;
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

  // Tour actions
  function startTour() {
    tourStep.value = 0;
    tourActive.value = true;
  }

  function nextStep() {
    if (tourStep.value < TOUR_STEPS_COUNT - 1) {
      tourStep.value++;
    } else {
      skipTour();
    }
  }

  function prevStep() {
    if (tourStep.value > 0) tourStep.value--;
  }

  async function skipTour() {
    tourActive.value = false;
    tourSeen.value = true;
    try {
      const store = await load("mdview-settings.json", { autoSave: true, defaults: {} });
      await store.set("tour_seen", true);
      await store.save();
    } catch (e) {
      console.error("skipTour persist failed", e);
    }
  }

  async function initTour() {
    if (tourSeen.value) return;
    try {
      const store = await load("mdview-settings.json", { autoSave: true, defaults: {} });
      const seen = await store.get<boolean>("tour_seen");
      if (seen === true) {
        tourSeen.value = true;
        return;
      }
    } catch {
      // If store unavailable, still show tour
    }
    startTour();
  }

  return {
    toastMessage,
    showToast,
    sidebarVisible,
    sidebarWidth,
    bottomPanelVisible,
    bottomPanelHeight,
    settingsOpen,
    sidebarView,
    targetLine,
    currentHeadings,
    activeHeadingIndex,
    navigateHeadingTrigger,
    tourActive,
    tourStep,
    tourSeen,
    toggleSidebar,
    toggleBottomPanel,
    showBottomPanel,
    setBottomPanelHeight,
    setSidebarWidth,
    openSettings,
    closeSettings,
    setSidebarView,
    setCurrentHeadings,
    setActiveHeadingIndex,
    triggerNavigateHeading,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    initTour,
  };
});
