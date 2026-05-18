<script setup lang="ts">
import { useTabsStore } from "../stores/tabs";

const tabs = useTabsStore();

function onCloseClick(e: MouseEvent, path: string) {
  e.stopPropagation();
  void tabs.closeTab(path);
}
</script>

<template>
  <div class="tab-bar" v-if="tabs.tabs.length > 0">
    <div
      v-for="tab in tabs.tabs"
      :key="tab.path"
      class="tab"
      :class="{ active: tabs.activePath === tab.path }"
      :title="tab.path"
      @click="tabs.setActive(tab.path)"
    >
      <span class="tab-name">{{ tab.name }}</span>
      <span class="tab-dirty" v-if="tabs.isDirty(tab)">●</span>
      <button
        class="tab-close"
        :class="{ 'has-dirty': tabs.isDirty(tab) }"
        @click="onCloseClick($event, tab.path)"
        title="Close (Cmd/Ctrl+W)"
      >
        ×
      </button>
    </div>
  </div>
</template>

<style>
.tab-bar {
  display: flex;
  background: var(--bg-tab-bar);
  border-bottom: 1px solid var(--border);
  height: 32px;
  flex: 0 0 32px;
  overflow-x: auto;
  overflow-y: hidden;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 8px 0 12px;
  border-right: 1px solid var(--border);
  background: var(--bg-tab-inactive);
  cursor: pointer;
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  position: relative;
  min-width: 100px;
  max-width: 200px;
}

.tab:hover {
  background: var(--bg-hover);
}

.tab.active {
  background: var(--bg-tab-active);
  color: var(--text);
}

.tab.active::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--accent);
}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.tab-dirty {
  color: var(--text);
  font-size: 14px;
  line-height: 1;
}

.tab-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 0;
  margin: 0;
  width: 18px;
  height: 18px;
  border-radius: 3px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
}

.tab:hover .tab-close,
.tab.active .tab-close,
.tab-close.has-dirty {
  opacity: 1;
}

.tab-close:hover {
  background: var(--bg-hover);
  color: var(--text);
}
</style>
