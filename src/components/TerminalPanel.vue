<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useWorkspaceStore } from "../stores/workspace";
import { useThemeStore } from "../stores/theme";

const workspace = useWorkspaceStore();
const theme = useThemeStore();

const container = ref<HTMLDivElement | null>(null);
let term: Terminal | null = null;
let fit: FitAddon | null = null;
let ptyId: number | null = null;
let unlistenData: UnlistenFn | null = null;
let unlistenExit: UnlistenFn | null = null;
let resizeObs: ResizeObserver | null = null;
let spawned = false;

const darkTheme = {
  background: "#1e1e1e",
  foreground: "#cccccc",
  cursor: "#cccccc",
  selectionBackground: "#264f78",
};

const lightTheme = {
  background: "#ffffff",
  foreground: "#333333",
  cursor: "#333333",
  selectionBackground: "#add6ff",
};

function applyTheme() {
  if (!term) return;
  term.options.theme = theme.theme === "dark" ? darkTheme : lightTheme;
}

async function spawn() {
  if (!term) return;
  const cwd = workspace.rootPath ?? undefined;
  const cols = term.cols || 80;
  const rows = term.rows || 24;
  try {
    ptyId = await invoke<number>("pty_spawn", { cwd, cols, rows });
  } catch (e) {
    term.writeln(`\r\n\x1b[31mFailed to spawn shell: ${e}\x1b[0m`);
    spawned = false;
  }
}

async function attachListeners() {
  unlistenData = await listen<{ id: number; data: string }>("pty-data", (e) => {
    if (e.payload.id !== ptyId) return;
    term?.write(e.payload.data);
  });
  unlistenExit = await listen<{ id: number }>("pty-exit", (e) => {
    if (e.payload.id !== ptyId) return;
    term?.writeln("\r\n\x1b[33m[process exited]\x1b[0m");
    ptyId = null;
  });
}

function tryFitAndSpawn() {
  if (!fit || !term) return;
  try {
    fit.fit();
  } catch {
    /* ignore */
  }
  if (!spawned && term.cols > 1 && term.rows > 1) {
    spawned = true;
    void spawn();
  }
}

onMounted(async () => {
  if (!container.value) return;
  term = new Terminal({
    fontFamily:
      '"SF Mono", Menlo, Monaco, Consolas, "Courier New", monospace',
    fontSize: 12,
    cursorBlink: true,
    scrollback: 5000,
    allowProposedApi: true,
  });
  fit = new FitAddon();
  term.loadAddon(fit);
  term.open(container.value);
  applyTheme();

  term.onData((data) => {
    if (ptyId === null) return;
    invoke("pty_write", { id: ptyId, data }).catch((e) =>
      console.error("pty_write failed", e)
    );
  });
  term.onResize(({ cols, rows }) => {
    if (ptyId === null) return;
    invoke("pty_resize", { id: ptyId, cols, rows }).catch((e) =>
      console.error("pty_resize failed", e)
    );
  });

  await attachListeners();
  tryFitAndSpawn();

  resizeObs = new ResizeObserver(() => tryFitAndSpawn());
  resizeObs.observe(container.value);
});

onBeforeUnmount(async () => {
  resizeObs?.disconnect();
  unlistenData?.();
  unlistenExit?.();
  if (ptyId !== null) {
    try {
      await invoke("pty_kill", { id: ptyId });
    } catch {
      /* ignore */
    }
  }
  term?.dispose();
});

watch(() => theme.theme, applyTheme);
</script>

<template>
  <div ref="container" class="terminal-host"></div>
</template>

<style>
.terminal-host {
  flex: 1;
  min-height: 0;
  padding: 4px 6px;
  background: var(--bg-app);
  overflow: hidden;
}
.terminal-host .xterm {
  height: 100%;
}
.terminal-host .xterm-viewport {
  background-color: transparent !important;
}
</style>
