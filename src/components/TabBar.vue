<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { Icon } from "@iconify/vue";
import { useTabsStore } from "../stores/tabs";
import { useThemeStore } from "../stores/theme";
import { useUiStore } from "../stores/ui";

const tabs = useTabsStore();
const theme = useThemeStore();
const ui = useUiStore();

const tabListRef = ref<HTMLDivElement | null>(null);
const showLeftChevron = ref(false);
const showRightChevron = ref(false);

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

let dragSourceIndex = -1;

function onDragStart(e: DragEvent, index: number) {
  dragSourceIndex = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
}

function onDrop(e: DragEvent, index: number) {
  e.preventDefault();
  if (dragSourceIndex >= 0 && dragSourceIndex !== index) {
    tabs.moveTab(dragSourceIndex, index);
  }
  dragSourceIndex = -1;
}

function onDragEnd() {
  dragSourceIndex = -1;
}

function checkOverflow() {
  const el = tabListRef.value;
  if (!el) return;
  showRightChevron.value = el.scrollWidth > el.clientWidth + 1;
  showLeftChevron.value = el.scrollLeft > 1;
}

function scrollTabs(delta: number) {
  const el = tabListRef.value;
  if (!el) return;
  el.scrollBy({ left: delta, behavior: "smooth" });
  void nextTick().then(checkOverflow);
}

onMounted(() => {
  window.addEventListener("click", onWindowClick);
  checkOverflow();
});
onBeforeUnmount(() => {
  window.removeEventListener("click", onWindowClick);
});
</script>

<template>
  <div class="tab-bar">
    <button
      v-show="showLeftChevron"
      class="chevron-btn"
      title="Scroll left"
      @click="scrollTabs(-200)"
    >
      <Icon icon="lucide:chevron-left" width="14" height="14" />
    </button>
    <div ref="tabListRef" class="tab-list" @scroll="checkOverflow">
      <div
        v-for="(tab, index) in tabs.tabs"
        :key="tab.path"
        class="tab"
        :class="{ active: tabs.activePath === tab.path }"
        :title="tab.path"
        draggable="true"
        @click="tabs.setActive(tab.path)"
        @contextmenu="onTabContextMenu($event, tab.path)"
        @dragstart="onDragStart($event, index)"
        @dragover="onDragOver"
        @drop="onDrop($event, index)"
        @dragend="onDragEnd"
      >
        <span class="tab-name">{{ tab.name }}</span>
        <span class="tab-dirty" v-if="tabs.isDirty(tab)">●</span>
        <button
          class="tab-close"
          :class="{ 'has-dirty': tabs.isDirty(tab) }"
          @click="onCloseClick($event, tab.path)"
          title="Close (Cmd/Ctrl+W)"
        >
          <Icon icon="lucide:x" width="12" height="12" />
        </button>
      </div>
    </div>
    <button
      v-show="showRightChevron"
      class="chevron-btn"
      title="Scroll right"
      @click="scrollTabs(200)"
    >
      <Icon icon="lucide:chevron-right" width="14" height="14" />
    </button>
    <div class="tab-bar-actions">
      <button
        class="icon-btn"
        :title="theme.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="theme.toggle()"
      >
        <Icon :icon="theme.theme === 'dark' ? 'lucide:sun' : 'lucide:moon'" width="16" height="16" />
      </button>
      <button class="icon-btn" title="Settings" @click="ui.openSettings()">
        <Icon icon="lucide:settings" width="16" height="16" />
      </button>
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
  transition: opacity 0.15s;
}

.tab:active {
  opacity: 0.6;
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

.chevron-btn {
  width: 24px;
  height: 100%;
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.chevron-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.tab-bar-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px;
  flex-shrink: 0;
}
</style>
