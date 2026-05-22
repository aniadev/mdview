<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { useTabsStore } from "../stores/tabs";
import { useUiStore } from "../stores/ui";
import SplitPane from "./SplitPane.vue";
import SourceEditor from "./SourceEditor.vue";
import PreviewPane from "./PreviewPane.vue";
import GraphPanel from "./GraphPanel.vue";
import { useI18n } from "../i18n";

const { t } = useI18n();

const tabs = useTabsStore();
const ui = useUiStore();
const ratio = ref(0.5);
const scrollPercent = ref(0);
const previewScrollPercent = ref(0);
const headingIndex = ref(-1);
const previewHeadingIndex = ref(-1);
const previewRef = ref<InstanceType<typeof PreviewPane> | null>(null);
const editorRef = ref<InstanceType<typeof SourceEditor> | null>(null);

function onToggleChecklist(idx: number, checked: boolean) {
  if (editorRef.value) {
    (editorRef.value as any).toggleChecklist(idx, checked);
  }
}

const tab = computed(() => tabs.activeTab);

function onUpdate(value: string) {
  if (!tab.value) return;
  tabs.setContent(tab.value.path, value);
}

const scrollMaster = ref<"editor" | "preview" | null>(null);
let scrollLockTimer: number | null = null;

function acquireLock(source: "editor" | "preview") {
  if (scrollMaster.value !== null && scrollMaster.value !== source) {
    return false;
  }
  scrollMaster.value = source;
  if (scrollLockTimer !== null) window.clearTimeout(scrollLockTimer);
  scrollLockTimer = window.setTimeout(() => {
    scrollMaster.value = null;
  }, 150);
  return true;
}

function onScroll(pct: number) {
  if (!acquireLock("editor")) return;
  scrollPercent.value = pct;
}

function onPreviewScroll(pct: number) {
  if (!acquireLock("preview")) return;
  previewScrollPercent.value = pct;
}

watch(
  () => ui.navigateHeadingTrigger,
  () => {
    const idx = ui.activeHeadingIndex;
    if (idx >= 0) {
      headingIndex.value = idx;
      previewHeadingIndex.value = idx;
    }
  }
);

async function onSave() {
  await tabs.saveActive();
}

async function onOpenBrowser() {
  if (!tab.value || !previewRef.value) return;
  const html = (previewRef.value as unknown as {
    buildStandaloneHtml: (t: string) => string;
  }).buildStandaloneHtml(tab.value.name);
  try {
    const path = await invoke<string>("write_temp_html", {
      html,
      baseName: tab.value.name,
    });
    await openPath(path);
  } catch (e) {
    console.error("open in browser failed", e);
  }
}
</script>

<template>
  <div class="editor-area" v-if="tab">
    <GraphPanel v-if="tab.path === 'app://graph'" />
    <template v-else>
      <div v-if="tab.loading" class="empty-editor">{{ t('preview.loading', { name: tab.name }) }}</div>
      <div v-else-if="tab.loadError" class="empty-editor" style="color: var(--danger)">
        {{ tab.loadError }}
      </div>
      <SplitPane
        v-else
        :initial="ratio"
        @update:ratio="ratio = $event"
      >
        <template #left>
          <SourceEditor
            ref="editorRef"
            :model-value="tab.content"
            :tab-key="tab.path"
            :scroll-percent="previewScrollPercent"
            :scroll-to-heading="previewHeadingIndex"
            :target-line="ui.targetLine"
            @update:model-value="onUpdate"
            @scroll="onScroll"
            @save="onSave"
            @open-browser="onOpenBrowser"
          />
        </template>
        <template #right>
          <PreviewPane
            ref="previewRef"
            :source="tab.content"
            :file-path="tab.path"
            :scroll-percent="scrollPercent"
            :scroll-to-heading="headingIndex"
            @scroll="onPreviewScroll"
            @toggle-checklist="onToggleChecklist"
          />
        </template>
      </SplitPane>
    </template>
  </div>
</template>

<style>
.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
</style>
