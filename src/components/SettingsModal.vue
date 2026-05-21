<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { Icon } from "@iconify/vue";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { load } from "@tauri-apps/plugin-store";
import { open } from "@tauri-apps/plugin-dialog";
import { useUiStore } from "../stores/ui";
import { useUpdaterStore } from "../stores/updater";
import { useI18n } from "../i18n";
import Button from "./ui/Button.vue";
import AppDialog from "./ui/Dialog.vue";

const ui = useUiStore();
const updater = useUpdaterStore();
const { t, currentLocale, persistLocale } = useI18n();

const selectedLocale = ref(currentLocale.value);

async function changeLocale() {
  await persistLocale(selectedLocale.value as 'en' | 'vi');
}

const appVersion = ref<string>("");
const REPO_URL = "https://github.com/aniadev/mdview";

async function openRepo() {
  try {
    await openUrl(REPO_URL);
  } catch (e) {
    console.error("openUrl failed", e);
  }
}

const dailyNotesFolder = ref("");

async function saveDailyNotesFolder() {
  try {
    const store = await load("mdview-settings.json", { autoSave: true, defaults: {} });
    await store.set("daily_notes_folder", dailyNotesFolder.value.trim());
    await store.save();
  } catch (e) {
    console.error("saveDailyNotesFolder failed", e);
  }
}

async function browseDailyNotesFolder() {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("settings.dailyNotesFolder"),
    });
    if (selected && typeof selected === "string") {
      dailyNotesFolder.value = selected;
      await saveDailyNotesFolder();
    }
  } catch (e) {
    console.error("browseDailyNotesFolder failed", e);
  }
}

onMounted(async () => {
  try {
    appVersion.value = await getVersion();
  } catch (e) {
    console.error("getVersion failed", e);
  }
  try {
    const store = await load("mdview-settings.json", { autoSave: true, defaults: {} });
    const saved = await store.get<string>("daily_notes_folder");
    if (saved) {
      dailyNotesFolder.value = saved;
    }
  } catch (e) {
    console.error("load settings failed", e);
  }
});

const updateStatusText = computed(() => {
  switch (updater.state) {
    case "checking":
      return "Checking for updates…";
    case "no-update":
      return "You're on the latest version.";
    case "available":
      return `v${updater.update?.version} is available.`;
    case "downloading":
      return `Downloading… ${updater.progressPct}%`;
    case "ready":
      return "Update downloaded — installing.";
    case "error":
      return updater.errorMsg ?? "Update check failed.";
    default:
      return "";
  }
});

const isCheckingOrDownloading = computed(() => {
  return updater.state === "checking" || updater.state === "downloading";
});

function onCheck() {
  void updater.checkForUpdates({ silent: false });
}

function onClose() {
  ui.closeSettings();
}
</script>

<template>
  <AppDialog
    :open="ui.settingsOpen"
    class="w-[540px] max-w-full max-h-[80vh] overflow-hidden"
    @update:open="v => !v && onClose()"
  >
        <header class="settings-header flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h2 class="settings-title m-0 text-sm font-semibold text-text tracking-wide">{{ t('settings.title') }}</h2>
          <Button
            variant="ghost"
            size="icon"
            :title="t('settings.close')"
            @click="onClose"
          >
            <Icon icon="lucide:x" width="16" height="16" />
          </Button>
        </header>

        <div class="settings-body flex-1 overflow-y-auto py-2">
          <!-- About Section -->
          <section class="settings-section px-5 py-3.5 border-b border-border last:border-b-0">
            <h3 class="settings-section-title m-0 mb-2.5 text-[11px] uppercase tracking-wider text-text-muted font-semibold">
              {{ t('settings.about') }}
            </h3>
            <div class="settings-row flex items-center justify-between gap-4 py-1.5 text-sm">
              <span class="settings-label text-text font-medium">{{ t('settings.version') }}</span>
              <span class="settings-value text-text-muted font-mono text-xs">v{{ appVersion || '…' }}</span>
            </div>
            <div class="settings-row flex items-center justify-between gap-4 py-1.5 text-sm">
              <span class="settings-label text-text font-medium">{{ t('settings.author') }}</span>
              <span class="settings-value text-text-muted font-mono text-xs">aniadev</span>
            </div>
            <div class="settings-row flex items-center justify-between gap-4 py-1.5 text-sm">
              <span class="settings-label text-text font-medium">{{ t('settings.license') }}</span>
              <span class="settings-value text-text-muted font-mono text-xs">MIT</span>
            </div>
            <div class="settings-row flex items-center justify-between gap-4 py-1.5 text-sm">
              <span class="settings-label text-text font-medium">{{ t('settings.github') }}</span>
              <a
                class="settings-link text-accent text-xs no-underline cursor-pointer hover:underline transition-all duration-150"
                @click.prevent="openRepo"
                :href="REPO_URL"
              >
                aniadev/mdview
              </a>
            </div>
          </section>

          <!-- Language Section -->
          <section class="settings-section px-5 py-3.5 border-b border-border last:border-b-0">
            <h3 class="settings-section-title m-0 mb-2.5 text-[11px] uppercase tracking-wider text-text-muted font-semibold">
              {{ t('settings.language') }}
            </h3>
            <div class="settings-row flex items-center justify-between gap-4 py-1.5 text-sm">
              <span class="settings-label text-text font-medium">{{ t('settings.language') }}</span>
              <select
                v-model="selectedLocale"
                class="settings-select bg-app border border-border rounded px-2 py-1 text-xs text-text cursor-pointer outline-none focus:border-accent transition-colors duration-150"
                @change="changeLocale"
              >
                <option value="en">{{ t('settings.langEn') }}</option>
                <option value="vi">{{ t('settings.langVi') }}</option>
              </select>
            </div>
          </section>

          <!-- Daily Notes Section -->
          <section class="settings-section px-5 py-3.5 border-b border-border last:border-b-0">
            <h3 class="settings-section-title m-0 mb-2.5 text-[11px] uppercase tracking-wider text-text-muted font-semibold">
              {{ t('settings.dailyNotesHeader') }}
            </h3>
            <div class="settings-row flex flex-col items-start gap-2 py-1.5 text-sm">
              <span class="settings-label text-text font-medium">{{ t('settings.dailyNotesFolder') }}</span>
              <div class="settings-row-input flex items-center gap-2 w-full">
                <input
                  v-model="dailyNotesFolder"
                  type="text"
                  class="settings-input bg-app border border-border rounded px-2 py-[5px] text-xs text-text outline-none flex-1 focus:border-accent transition-all duration-150"
                  :placeholder="t('settings.dailyNotesFolderDesc')"
                  @change="saveDailyNotesFolder"
                />
                <Button
                  variant="default"
                  size="icon"
                  @click="browseDailyNotesFolder"
                >
                  <Icon icon="lucide:folder-open" width="14" height="14" />
                </Button>
              </div>
              <div class="settings-help mt-0.5 text-[11px] text-text-muted">
                {{ t('settings.dailyNotesFolderDesc') }}
              </div>
            </div>
          </section>

          <!-- Updates Section -->
          <section class="settings-section px-5 py-3.5 border-b border-border last:border-b-0">
            <h3 class="settings-section-title m-0 mb-2.5 text-[11px] uppercase tracking-wider text-text-muted font-semibold">
              {{ t('settings.updates') }}
            </h3>
            <div class="settings-row flex items-center justify-between gap-4 py-1.5 text-sm">
              <div class="settings-row-main flex-1 min-w-0">
                <div class="settings-label text-text font-medium">{{ t('settings.checkUpdate') }}</div>
                <div
                  v-if="updateStatusText"
                  class="settings-help mt-0.5 text-[11px]"
                  :class="updater.state === 'error' ? 'text-danger' : 'text-text-muted'"
                >
                  {{ updateStatusText }}
                </div>
                <div v-else class="settings-help mt-0.5 text-[11px] text-text-muted">
                  {{ t('settings.autoCheck') }}
                </div>
              </div>
              <Button
                variant="default"
                :disabled="isCheckingOrDownloading"
                @click="onCheck"
              >
                <span
                  v-if="updater.state === 'checking'"
                  class="w-3 h-3 rounded-full border-2 border-border border-t-accent animate-spin inline-block mr-1"
                ></span>
                <span v-else>{{ t('settings.checkNow') }}</span>
              </Button>
            </div>
          </section>
        </div>
  </AppDialog>
</template>

<style lang="scss" scoped>
.settings-body {
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
    transition: background-color 0.15s;

    &:hover {
      background: var(--text-muted);
    }
  }
}
</style>
