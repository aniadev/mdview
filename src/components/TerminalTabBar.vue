<script setup lang="ts">
import { ref } from "vue";
import { useTerminalStore } from "../stores/terminal";

const termStore = useTerminalStore();

const editingUid = ref<number | null>(null);
const editValue = ref("");

function onCreate() {
  termStore.createSession();
}

function onSwitch(uid: number) {
  if (editingUid.value !== null) return;
  termStore.switchTo(uid);
}

function onClose(e: MouseEvent, uid: number) {
  e.stopPropagation();
  termStore.closeSession(uid);
}

function startRename(uid: number, currentLabel: string) {
  editingUid.value = uid;
  editValue.value = currentLabel;
}

function focusEditInput(el: unknown) {
  if (el instanceof HTMLInputElement) {
    el.focus();
    el.select();
  }
}

function commitRename() {
  if (editingUid.value === null) return;
  termStore.rename(editingUid.value, editValue.value);
  editingUid.value = null;
}

function cancelRename() {
  editingUid.value = null;
}

function onRenameKey(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    commitRename();
  } else if (e.key === "Escape") {
    e.preventDefault();
    cancelRename();
  }
}
</script>

<template>
  <div class="term-tab-bar">
    <div class="term-tab-list">
      <div
        v-for="s in termStore.sessions"
        :key="s.uid"
        class="term-tab"
        :class="{ active: termStore.activeUid === s.uid }"
        @click="onSwitch(s.uid)"
        @dblclick="startRename(s.uid, termStore.displayLabel(s))"
        :title="termStore.displayLabel(s)"
      >
        <template v-if="editingUid === s.uid">
          <input
            :ref="focusEditInput"
            v-model="editValue"
            class="term-tab-input"
            maxlength="30"
            spellcheck="false"
            @blur="commitRename"
            @keydown="onRenameKey"
            @click.stop
          />
        </template>
        <template v-else>
          <span class="term-tab-label">{{ termStore.displayLabel(s) }}</span>
          <button
            class="term-tab-close"
            title="Close"
            @click="onClose($event, s.uid)"
          >×</button>
        </template>
      </div>
    </div>
    <button class="term-tab-add" title="New Terminal" @click="onCreate">+</button>
  </div>
</template>

<style>
.term-tab-bar {
  display: flex;
  align-items: stretch;
  height: 26px;
  flex: 0 0 26px;
  background: var(--bg-tab-bar);
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}

.term-tab-list {
  display: flex;
  flex: 1;
  overflow-x: auto;
}

.term-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px 0 12px;
  border-right: 1px solid var(--border);
  background: var(--bg-tab-inactive);
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  min-width: 100px;
  max-width: 220px;
}

.term-tab:hover {
  background: var(--bg-hover);
}

.term-tab.active {
  background: var(--bg-tab-active);
  color: var(--text);
}

.term-tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.term-tab-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  width: 18px;
  height: 18px;
  border-radius: 3px;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
}

.term-tab:hover .term-tab-close,
.term-tab.active .term-tab-close {
  opacity: 1;
}

.term-tab-close:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.term-tab-input {
  flex: 1;
  background: var(--bg-app);
  border: 1px solid var(--accent);
  color: var(--text);
  padding: 1px 4px;
  font-size: 12px;
  font-family: inherit;
  border-radius: 2px;
  outline: none;
  min-width: 0;
}

.term-tab-add {
  flex: 0 0 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0;
  border-radius: 0;
}

.term-tab-add:hover {
  color: var(--text);
  background: var(--bg-hover);
}
</style>
