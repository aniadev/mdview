<script setup lang="ts">
import { computed } from "vue";
import MarkdownIt from "markdown-it";
import { useUpdaterStore } from "../stores/updater";

const updater = useUpdaterStore();

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
});

const releaseHtml = computed(() => {
  const body = updater.update?.body ?? "";
  return md.render(body);
});

const newVersion = computed(() => updater.update?.version ?? "");
const currentVersion = computed(() => updater.update?.currentVersion ?? "");

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="updater.modalOpen"
      class="update-overlay"
      @click="updater.closeModal()"
    >
      <div class="update-modal" @click.stop>
        <header class="update-modal-header">
          <div class="update-modal-title">
            mdview <strong>v{{ newVersion }}</strong> available
          </div>
          <div class="update-modal-subtitle">
            current: v{{ currentVersion }}
          </div>
        </header>

        <div class="update-modal-body">
          <template v-if="updater.state === 'downloading' || updater.state === 'ready'">
            <div class="update-progress-wrap">
              <div class="update-progress-label">
                <span v-if="updater.state === 'ready'">Download complete</span>
                <span v-else>
                  Downloading… {{ updater.progressPct }}%
                  <template v-if="updater.totalBytes > 0">
                    ({{ formatBytes(updater.downloadedBytes) }} /
                    {{ formatBytes(updater.totalBytes) }})
                  </template>
                </span>
              </div>
              <div class="update-progress-bar">
                <div
                  class="update-progress-fill"
                  :style="{ width: updater.progressPct + '%' }"
                ></div>
              </div>
            </div>
          </template>
          <template v-else-if="updater.state === 'error'">
            <div class="update-error">
              <strong>Update failed</strong>
              <div class="update-error-msg">{{ updater.errorMsg }}</div>
            </div>
          </template>
          <template v-else>
            <h3 class="update-notes-heading">Release notes</h3>
            <div class="update-notes markdown-body" v-html="releaseHtml"></div>
          </template>
        </div>

        <footer class="update-modal-footer">
          <template v-if="updater.state === 'downloading'">
            <button class="primary" disabled>Downloading…</button>
          </template>
          <template v-else-if="updater.state === 'ready'">
            <button class="primary" disabled>Installing…</button>
          </template>
          <template v-else-if="updater.state === 'error'">
            <button @click="updater.closeModal()">Close</button>
            <button class="primary" @click="updater.retry()">Try again</button>
          </template>
          <template v-else>
            <button @click="updater.closeModal()">Later</button>
            <button class="primary" @click="updater.startInstall()">
              Install &amp; Restart
            </button>
          </template>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style>
.update-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 24px;
}

.update-modal {
  width: 560px;
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

.update-modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.update-modal-title {
  font-size: 15px;
  color: var(--text);
}

.update-modal-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.update-modal-body {
  flex: 1;
  min-height: 120px;
  overflow-y: auto;
  padding: 14px 20px;
  font-size: 13px;
  color: var(--text);
}

.update-notes-heading {
  margin: 0 0 6px 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  font-weight: 600;
}

.update-notes p {
  margin: 0 0 0.7em 0;
}

.update-notes ul,
.update-notes ol {
  margin: 0 0 0.7em 0;
  padding-left: 1.4em;
}

.update-notes code {
  background: var(--bg-hover);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 0.85em;
}

.update-progress-wrap {
  padding: 8px 0;
}

.update-progress-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.update-progress-bar {
  width: 100%;
  height: 6px;
  background: var(--bg-hover);
  border-radius: 3px;
  overflow: hidden;
}

.update-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.15s linear;
}

.update-error {
  color: var(--danger);
  font-size: 13px;
}

.update-error-msg {
  margin-top: 6px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  word-break: break-word;
}

.update-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  background: var(--bg-app);
}

.update-toast {
  position: fixed;
  bottom: 18px;
  right: 18px;
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 8px 14px;
  border-radius: 4px;
  font-size: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  z-index: 250;
  animation: toast-in 0.18s ease-out;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
