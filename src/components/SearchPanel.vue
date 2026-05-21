<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Icon } from "@iconify/vue";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "../stores/workspace";
import { useTabsStore } from "../stores/tabs";
import { useUiStore } from "../stores/ui";
import { useI18n } from "../i18n";

const { t } = useI18n();
const workspace = useWorkspaceStore();
const tabs = useTabsStore();
const ui = useUiStore();

const query = ref("");
const results = ref<Array<{ path: string; line_number: number; line_content: string }>>([]);
const searching = ref(false);
let searchDebounce: number | null = null;

interface GroupedFile {
  path: string;
  name: string;
  relPath: string;
  matches: Array<{ line_number: number; line_content: string }>;
}

const groupedResults = computed<GroupedFile[]>(() => {
  const groups = new Map<string, GroupedFile>();
  for (const r of results.value) {
    if (!groups.has(r.path)) {
      const parts = r.path.replace(/\\/g, "/").split("/");
      const name = parts.pop() || "";
      // Resolve relative path to make it look clean
      let relPath = r.path;
      for (const root of workspace.roots) {
        const normalizedRoot = root.path.replace(/\\/g, "/");
        const normalizedPath = r.path.replace(/\\/g, "/");
        if (normalizedPath.startsWith(normalizedRoot)) {
          relPath = normalizedPath.slice(normalizedRoot.length).replace(/^\//, "");
          break;
        }
      }
      groups.set(r.path, {
        path: r.path,
        name,
        relPath,
        matches: [],
      });
    }
    groups.get(r.path)!.matches.push({
      line_number: r.line_number,
      line_content: r.line_content,
    });
  }
  return Array.from(groups.values());
});

const totalMatches = computed(() => results.value.length);
const filesCount = computed(() => groupedResults.value.length);

async function performSearch() {
  if (query.value.trim().length === 0) {
    results.value = [];
    searching.value = false;
    return;
  }
  searching.value = true;
  try {
    const rootsList = workspace.roots.map((r) => r.path);
    const searchData = await invoke<Array<{ path: string; line_number: number; line_content: string }>>(
      "search_workspace",
      {
        query: query.value,
        roots: rootsList,
      }
    );
    results.value = searchData;
  } catch (e) {
    console.error("Workspace search failed:", e);
  } finally {
    searching.value = false;
  }
}

watch(query, () => {
  if (searchDebounce !== null) clearTimeout(searchDebounce);
  searchDebounce = window.setTimeout(() => {
    searchDebounce = null;
    void performSearch();
  }, 300);
});

function clearQuery() {
  query.value = "";
  results.value = [];
}

async function selectMatch(path: string, name: string, line: number) {
  await tabs.openFile(path, name);
  ui.targetLine = line;
}

// Highlight the matched text in the snippet
function highlightText(text: string, q: string): string {
  if (!q.trim()) return text;
  const escaped = q.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  // Escape HTML to prevent XSS before injecting mark tags
  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  return escapedText.replace(
    regex,
    `<mark class="search-highlight">$1</mark>`
  );
}
</script>

<template>
  <div class="search-panel">
    <div class="search-header-box">
      <div class="search-input-wrapper">
        <Icon icon="lucide:search" class="search-input-icon" width="14" height="14" />
        <input
          v-model="query"
          type="text"
          class="search-input-field"
          :placeholder="t('search.placeholder')"
          autofocus
        />
        <button
          v-if="query.length > 0"
          class="search-clear-btn"
          @click="clearQuery"
        >
          <Icon icon="lucide:x" width="12" height="12" />
        </button>
      </div>
    </div>

    <div class="search-results-area">
      <div v-if="searching" class="search-status-message">
        <div class="spinner"></div>
        <span>{{ t('search.loading') }}</span>
      </div>

      <div v-else-if="query.trim().length === 0" class="search-empty-state">
        <Icon icon="lucide:search" class="empty-icon" width="40" height="40" />
        <p class="empty-title">{{ t('search.title') }}</p>
        <p class="empty-subtitle">{{ t('search.placeholder') }}</p>
      </div>

      <div v-else-if="results.length === 0" class="search-empty-state">
        <Icon icon="lucide:search-code" class="empty-icon text-danger" width="40" height="40" />
        <p class="empty-title">{{ t('search.noResults') }}</p>
      </div>

      <div v-else class="search-list-wrapper">
        <div class="search-summary-bar">
          {{ t('search.resultsCount', { count: totalMatches, filesCount }) }}
        </div>

        <div class="search-grouped-files">
          <div v-for="file in groupedResults" :key="file.path" class="search-file-group">
            <div class="search-file-header" :title="file.path">
              <Icon icon="lucide:file-text" class="file-icon" width="13" height="13" />
              <span class="file-name">{{ file.name }}</span>
              <span class="file-relpath">{{ file.relPath }}</span>
            </div>
            
            <div class="search-file-matches">
              <div
                v-for="match in file.matches"
                :key="match.line_number"
                class="search-match-row"
                @click="selectMatch(file.path, file.name, match.line_number)"
              >
                <span class="match-line-num">L{{ match.line_number }}</span>
                <span
                  class="match-snippet"
                  v-html="highlightText(match.line_content, query)"
                ></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.search-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-sidebar);
}

.search-header-box {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--bg-app);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input-wrapper:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.search-input-icon {
  color: var(--text-muted);
  margin-right: 6px;
  flex-shrink: 0;
}

.search-input-field {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  outline: none;
  width: 100%;
  padding: 2px 0;
}

.search-clear-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.search-clear-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.search-results-area {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.search-status-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: var(--text-muted);
  font-size: 12px;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: search-spin 0.8s linear infinite;
}

@keyframes search-spin {
  to { transform: rotate(360deg); }
}

.search-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--text-muted);
  flex: 1;
}

.empty-icon {
  margin-bottom: 12px;
  opacity: 0.4;
  animation: search-pulse 2s infinite ease-in-out;
}

@keyframes search-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

.empty-title {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--text);
}

.empty-subtitle {
  font-size: 11px;
  margin: 0;
}

.search-summary-bar {
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  background: var(--bg-tab-bar);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.search-grouped-files {
  display: flex;
  flex-direction: column;
}

.search-file-group {
  border-bottom: 1px solid var(--border);
}

.search-file-group:last-child {
  border-bottom: none;
}

.search-file-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-tab-bar);
  color: var(--text);
  font-weight: 600;
  font-size: 12px;
  user-select: none;
}

.file-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-relpath {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: normal;
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-left: 8px;
}

.search-file-matches {
  display: flex;
  flex-direction: column;
  padding: 2px 0;
}

.search-match-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 16px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.search-match-row:hover {
  background: var(--bg-hover);
}

.match-line-num {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
  width: 32px;
  text-align: right;
  padding-top: 1px;
}

.match-snippet {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text);
  word-break: break-all;
  white-space: pre-wrap;
  flex: 1;
}

.search-highlight {
  background: color-mix(in srgb, var(--accent) 30%, transparent);
  color: inherit;
  border-radius: 2px;
  padding: 0 2px;
  border-bottom: 1.5px solid var(--accent);
}
</style>
