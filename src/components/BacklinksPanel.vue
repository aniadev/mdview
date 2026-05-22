<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@iconify/vue";
import { useWorkspaceStore } from "../stores/workspace";
import { useTabsStore } from "../stores/tabs";
import { useI18n } from "../i18n";

interface BacklinkEntry {
  from_file: string;
  from_label: string;
  link_type: "wiki" | "md";
  line_number: number;
  context: string;
}

const props = defineProps<{ filePath: string }>();

const { t } = useI18n();
const workspace = useWorkspaceStore();
const tabs = useTabsStore();

const entries = ref<BacklinkEntry[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
let inflightId = 0;
let debounceTimer: number | null = null;
let unmounted = false;

async function fetchBacklinks(filePath: string) {
  if (!filePath || workspace.rootPaths.length === 0) {
    entries.value = [];
    error.value = null;
    loading.value = false;
    return;
  }
  inflightId += 1;
  const myId = inflightId;
  loading.value = true;
  error.value = null;
  try {
    const result = await invoke<BacklinkEntry[]>("find_backlinks", {
      filePath,
      roots: workspace.rootPaths,
    });
    if (myId !== inflightId || unmounted) return;
    entries.value = result;
  } catch (e) {
    if (myId !== inflightId || unmounted) return;
    error.value = String(e);
    entries.value = [];
    console.error("find_backlinks failed", e);
  } finally {
    if (myId === inflightId && !unmounted) loading.value = false;
  }
}

function scheduleFetch(filePath: string) {
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    if (!unmounted) fetchBacklinks(filePath);
  }, 100);
}

watch(
  () => props.filePath,
  (curr) => scheduleFetch(curr),
  { immediate: true }
);

onBeforeUnmount(() => {
  unmounted = true;
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer);
    debounceTimer = null;
  }
});

function onEntryClick(entry: BacklinkEntry) {
  const name = entry.from_file.split("/").pop() ?? entry.from_label;
  tabs.openFile(entry.from_file, name).catch((e) => console.error("openFile failed", e));
}
</script>

<template>
  <section class="backlinks-panel" :data-loading="loading">
    <header class="backlinks-header">
      <Icon icon="lucide:link" width="14" height="14" />
      <span class="backlinks-title">{{ t("backlinks.title") }}</span>
      <span v-if="entries.length > 0" class="backlinks-count">
        {{ t("backlinks.linkedFrom", { count: entries.length }) }}
      </span>
    </header>
    <div v-if="loading" class="backlinks-state">{{ t("backlinks.loading") }}</div>
    <div v-else-if="entries.length === 0" class="backlinks-state">
      {{ t("backlinks.empty") }}
    </div>
    <ul v-else class="backlinks-list">
      <li
        v-for="(entry, idx) in entries"
        :key="`${entry.from_file}:${entry.line_number}:${idx}`"
        class="backlink-item"
        @click="onEntryClick(entry)"
      >
        <div class="backlink-head">
          <Icon
            :icon="entry.link_type === 'wiki' ? 'lucide:link-2' : 'lucide:external-link'"
            width="12"
            height="12"
            :title="entry.link_type === 'wiki' ? t('backlinks.wikilink') : t('backlinks.mdLink')"
          />
          <span class="backlink-label">{{ entry.from_label }}</span>
          <span class="backlink-line">:L{{ entry.line_number }}</span>
        </div>
        <pre class="backlink-context">{{ entry.context }}</pre>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.backlinks-panel {
  border-top: 1px solid var(--border);
  margin-top: 32px;
  padding-top: 16px;
  font-size: 13px;
}

.backlinks-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  color: var(--text-muted);
}

.backlinks-title {
  font-weight: 600;
  color: var(--text);
}

.backlinks-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
}

.backlinks-state {
  color: var(--text-muted);
  font-size: 12px;
  padding: 8px 0;
}

.backlinks-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.backlink-item {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px 10px;
  background: var(--bg-sidebar, transparent);
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.backlink-item:hover {
  background: var(--bg-hover, transparent);
}

.backlink-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  color: var(--link);
  font-weight: 500;
}

.backlink-label {
  flex: 0 1 auto;
}

.backlink-line {
  font-size: 11px;
  color: var(--text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.backlink-context {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
  background: var(--bg-code, transparent);
  padding: 6px 8px;
  border-radius: 3px;
  overflow-x: auto;
}
</style>
