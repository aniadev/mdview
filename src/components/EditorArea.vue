<script setup lang="ts">
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { useTabsStore } from "../stores/tabs";
import SplitPane from "./SplitPane.vue";
import SourceEditor from "./SourceEditor.vue";
import PreviewPane from "./PreviewPane.vue";

const tabs = useTabsStore();
const ratio = ref(0.5);
const scrollPercent = ref(0);
const previewRef = ref<InstanceType<typeof PreviewPane> | null>(null);

const tab = computed(() => tabs.activeTab);

function onUpdate(value: string) {
  if (!tab.value) return;
  tabs.setContent(tab.value.path, value);
}

function onScroll(pct: number) {
  scrollPercent.value = pct;
}

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
    <div v-if="tab.loading" class="empty-editor">Loading {{ tab.name }}…</div>
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
          :model-value="tab.content"
          :tab-key="tab.path"
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
        />
      </template>
    </SplitPane>
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
