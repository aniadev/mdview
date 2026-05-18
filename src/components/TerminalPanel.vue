<script setup lang="ts">
import { onMounted } from "vue";
import { useTerminalStore } from "../stores/terminal";
import TerminalTabBar from "./TerminalTabBar.vue";
import TerminalView from "./TerminalView.vue";

const termStore = useTerminalStore();

onMounted(() => {
  // Only auto-create the first session on initial mount. After that, the user
  // controls session lifecycle via the "+" button; closing the last tab leaves
  // the panel intentionally empty.
  termStore.ensureFirst();
});

function onCreateFirst() {
  termStore.createSession();
}
</script>

<template>
  <div class="terminal-panel">
    <TerminalTabBar />
    <div class="terminal-stack">
      <div
        v-for="s in termStore.sessions"
        :key="s.uid"
        v-show="termStore.activeUid === s.uid"
        class="terminal-slot"
      >
        <TerminalView :session="s" :active="termStore.activeUid === s.uid" />
      </div>
      <div v-if="termStore.sessions.length === 0" class="terminal-empty">
        <p>No active terminal.</p>
        <button class="primary" @click="onCreateFirst">New Terminal</button>
      </div>
    </div>
  </div>
</template>

<style>
.terminal-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.terminal-stack {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
}

.terminal-slot {
  flex: 1;
  min-height: 0;
  display: flex;
}

.terminal-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: 12px;
}

.terminal-empty p {
  margin: 0;
}
</style>
