import { defineStore } from "pinia";
import { ref, shallowRef, computed } from "vue";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdaterState =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "error"
  | "no-update";

export const useUpdaterStore = defineStore("updater", () => {
  const state = ref<UpdaterState>("idle");
  const update = shallowRef<Update | null>(null);
  const downloadedBytes = ref(0);
  const totalBytes = ref(0);
  const errorMsg = ref<string | null>(null);
  const modalOpen = ref(false);
  const toastMessage = ref<string | null>(null);
  let toastTimer: number | null = null;

  const progressPct = computed(() => {
    if (totalBytes.value <= 0) return 0;
    return Math.min(100, Math.round((downloadedBytes.value / totalBytes.value) * 100));
  });

  function showToast(msg: string, ms = 2200) {
    toastMessage.value = msg;
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastMessage.value = null;
      toastTimer = null;
    }, ms);
  }

  async function checkForUpdates(opts: { silent: boolean } = { silent: false }) {
    if (state.value === "checking" || state.value === "downloading") return;
    state.value = "checking";
    errorMsg.value = null;
    try {
      const upd = await check();
      if (upd) {
        update.value = upd;
        state.value = "available";
        modalOpen.value = true;
        return;
      } else {
        state.value = "no-update";
        if (!opts.silent) showToast("mdview is up to date");
        return;
      }
    } catch (e) {
      console.error("update check failed", e);
      let msg = String(e);
      const isNoRelease = msg.toLowerCase().includes("could not fetch a valid release json");
      if (isNoRelease) {
        msg = "No release information found on the update server. The release might not be published yet.";
      }
      errorMsg.value = msg;
      state.value = "error";
      if (!opts.silent) {
        if (isNoRelease) {
          showToast("No release found on update server");
        } else {
          showToast(`Update check failed`);
        }
      }
    }
  }

  async function startInstall() {
    if (!update.value) return;
    


    state.value = "downloading";
    downloadedBytes.value = 0;
    totalBytes.value = 0;
    errorMsg.value = null;
    try {
      await update.value.downloadAndInstall((event) => {
        if (event.event === "Started") {
          totalBytes.value = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloadedBytes.value += event.data.chunkLength;
        } else if (event.event === "Finished") {
          state.value = "ready";
        }
      });
      await relaunch();
    } catch (e) {
      console.error("install failed", e);
      errorMsg.value = String(e);
      state.value = "error";
    }
  }

  function retry() {
    errorMsg.value = null;
    state.value = "available";
  }

  function closeModal() {
    if (state.value === "downloading") return;
    modalOpen.value = false;
    if (state.value !== "ready") {
      state.value = "idle";
      update.value = null;
    }
  }

  return {
    state,
    update,
    downloadedBytes,
    totalBytes,
    progressPct,
    errorMsg,
    modalOpen,
    toastMessage,
    checkForUpdates,
    startInstall,
    retry,
    closeModal,
  };
});
