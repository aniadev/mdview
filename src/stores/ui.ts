import { defineStore } from "pinia";
import { ref } from "vue";

export const useUiStore = defineStore("ui", () => {
  const sidebarVisible = ref(true);
  function toggleSidebar() {
    sidebarVisible.value = !sidebarVisible.value;
  }
  return { sidebarVisible, toggleSidebar };
});
