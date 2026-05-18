<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useTabsStore } from "../stores/tabs";
import { useUiStore } from "../stores/ui";

const tabs = useTabsStore();
const ui = useUiStore();

function onCloseClick(e: MouseEvent, path: string) {
  e.stopPropagation();
  void tabs.closeTab(path);
}

const ctxMenu = ref({ visible: false, x: 0, y: 0, targetPath: "" });

function onTabContextMenu(e: MouseEvent, path: string) {
  e.preventDefault();
  e.stopPropagation();
  tabs.setActive(path);
  ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, targetPath: path };
}

function closeCtxMenu() {
  ctxMenu.value.visible = false;
}

function ctxClose() {
  void tabs.closeTab(ctxMenu.value.targetPath);
  closeCtxMenu();
}

function ctxCloseAll() {
  void tabs.closeAllTabs();
  closeCtxMenu();
}

function onWindowClick() {
  if (ctxMenu.value.visible) closeCtxMenu();
}

onMounted(() => window.addEventListener("click", onWindowClick));
onBeforeUnmount(() => window.removeEventListener("click", onWindowClick));
</script>

<template>
  <div class="tab-bar">
    <button
      class="icon-btn tab-sidebar-btn"
      :title="ui.sidebarVisible ? 'Hide Sidebar (Cmd/Ctrl+B)' : 'Show Sidebar (Cmd/Ctrl+B)'"
      @click="ui.toggleSidebar()"
    >
      {{ ui.sidebarVisible ? "◀" : "▶" }}
    </button>
    <div class="tab-list">
      <div
        v-for="tab in tabs.tabs"
        :key="tab.path"
        class="tab"
        :class="{ active: tabs.activePath === tab.path }"
        :title="tab.path"
        @click="tabs.setActive(tab.path)"
        @contextmenu="onTabContextMenu($event, tab.path)"
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
  </div>

  <Teleport to="body">
    <div
      v-if="ctxMenu.visible"
      class="ctx-menu"
      :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      @click.stop
    >
      <button class="ctx-item" @click="ctxClose">Close</button>
      <button class="ctx-item" @click="ctxCloseAll">Close All Tabs</button>
    </div>
  </Teleport>
</template>

<style>
.tab-bar {
  display: flex;
  align-items: stretch;
  background: var(--bg-tab-bar);
  border-bottom: 1px solid var(--border);
  height: 32px;
  flex: 0 0 32px;
  overflow: hidden;
}

.tab-sidebar-btn {
  flex: 0 0 auto;
  border-right: 1px solid var(--border);
  border-radius: 0;
  border: none;
  border-right: 1px solid var(--border);
  height: 100%;
  width: 28px;
  padding: 0;
  font-size: 9px;
}

.tab-list {
  display: flex;
  flex: 1;
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

.ctx-menu {
  position: fixed;
  z-index: 1000;
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  min-width: 160px;
  padding: 4px 0;
}

.ctx-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 14px;
  background: transparent;
  border: none;
  border-radius: 0;
  font-size: 12px;
  color: var(--text);
  cursor: pointer;
}

.ctx-item:hover {
  background: var(--bg-selected);
}
</style>
