import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { load, Store } from "@tauri-apps/plugin-store";

export type Theme = "dark" | "light";

const STORE_FILE = "mdview-settings.json";
const KEY_THEME = "theme";
const KEY_PREVIEW_THEME = "preview_theme";

export const useThemeStore = defineStore("theme", () => {
  const theme = ref<Theme>("dark");
  const previewTheme = ref<Theme>("dark");
  let store: Store | null = null;
  let initialized = false;

  async function getStore(): Promise<Store> {
    if (!store) store = await load(STORE_FILE, { autoSave: true, defaults: {} });
    return store;
  }

  function apply(t: Theme) {
    document.documentElement.dataset.theme = t;
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    const s = await getStore();
    const saved = await s.get<Theme>(KEY_THEME);
    if (saved === "dark" || saved === "light") theme.value = saved;
    apply(theme.value);
    const savedPreview = await s.get<Theme>(KEY_PREVIEW_THEME);
    if (savedPreview === "dark" || savedPreview === "light") previewTheme.value = savedPreview;
  }

  async function setTheme(t: Theme) {
    theme.value = t;
    apply(t);
    const s = await getStore();
    await s.set(KEY_THEME, t);
    await s.save();
  }

  async function toggle() {
    await setTheme(theme.value === "dark" ? "light" : "dark");
  }

  async function togglePreviewTheme() {
    const next: Theme = previewTheme.value === "dark" ? "light" : "dark";
    previewTheme.value = next;
    const s = await getStore();
    await s.set(KEY_PREVIEW_THEME, next);
    await s.save();
  }

  watch(theme, (t) => apply(t));

  return { theme, previewTheme, init, setTheme, toggle, togglePreviewTheme };
});
