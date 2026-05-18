<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { getVersion } from "@tauri-apps/api/app";
import { useUiStore } from "../stores/ui";
import { useUpdaterStore } from "../stores/updater";

const ui = useUiStore();
const updater = useUpdaterStore();

const appVersion = ref<string>("");

onMounted(async () => {
  try {
    appVersion.value = await getVersion();
  } catch (e) {
    console.error("getVersion failed", e);
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

function onCheck() {
  void updater.checkForUpdates({ silent: false });
}

function onClose() {
  ui.closeSettings();
}
</script>

<template>
  <Teleport to="body">
    <div v-if="ui.settingsOpen" class="settings-overlay" @click="onClose">
      <div class="settings-modal" @click.stop>
        <header class="settings-header">
          <h2 class="settings-title">Settings</h2>
          <button class="icon-btn" title="Close" @click="onClose">×</button>
        </header>

        <div class="settings-body">
          <section class="settings-section">
            <h3 class="settings-section-title">About</h3>
            <div class="settings-row">
              <span class="settings-label">Version</span>
              <span class="settings-value">v{{ appVersion || "…" }}</span>
            </div>
          </section>

          <section class="settings-section">
            <h3 class="settings-section-title">Updates</h3>
            <div class="settings-row">
              <div class="settings-row-main">
                <div class="settings-label">Check for Updates</div>
                <div
                  v-if="updateStatusText"
                  class="settings-help"
                  :class="{ error: updater.state === 'error' }"
                >
                  {{ updateStatusText }}
                </div>
                <div v-else class="settings-help">
                  mdview checks automatically on startup.
                </div>
              </div>
              <button
                class="primary"
                :disabled="updater.state === 'checking' || updater.state === 'downloading'"
                @click="onCheck"
              >
                <span v-if="updater.state === 'checking'" class="spinner"></span>
                <span v-else>Check now</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 180;
  padding: 24px;
}

.settings-modal {
  width: 540px;
  max-width: 100%;
  max-height: 80vh;
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
}

.settings-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.2px;
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.settings-section {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
}

.settings-section:last-child {
  border-bottom: none;
}

.settings-section-title {
  margin: 0 0 10px 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  font-weight: 600;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 0;
  font-size: 13px;
}

.settings-row-main {
  flex: 1;
  min-width: 0;
}

.settings-label {
  color: var(--text);
  font-weight: 500;
}

.settings-value {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
}

.settings-help {
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-muted);
}

.settings-help.error {
  color: var(--danger);
}
</style>
