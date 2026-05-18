<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useWorkspaceStore } from "../stores/workspace";
import { useThemeStore } from "../stores/theme";
import { useTerminalStore, type TerminalSession } from "../stores/terminal";

const props = defineProps<{
  session: TerminalSession;
  active: boolean;
}>();

const workspace = useWorkspaceStore();
const theme = useThemeStore();
const termStore = useTerminalStore();

const container = ref<HTMLDivElement | null>(null);
let term: Terminal | null = null;
let fit: FitAddon | null = null;
let myPtyId: number | null = null;
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

function waitForWorkspace(timeoutMs: number): Promise<string | null> {
  if (workspace.rootPath) return Promise.resolve(workspace.rootPath);
  return new Promise((resolve) => {
    let done = false;
    const stop = watch(
      () => workspace.rootPath,
      (v) => {
        if (v && !done) {
          done = true;
          stop();
          clearTimeout(timer);
          resolve(v);
        }
      }
    );
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        stop();
        resolve(workspace.rootPath);
      }
    }, timeoutMs);
  });
}

async function spawn() {
  if (!term) return;
  const cwd = workspace.rootPath ?? undefined;
  const cols = term.cols || 80;
  const rows = term.rows || 24;
  try {
    myPtyId = await invoke<number>("pty_spawn", { cwd, cols, rows });
    termStore.setPtyId(props.session.uid, myPtyId);
  } catch (e) {
    term.writeln(`\r\n\x1b[31mFailed to spawn shell: ${e}\x1b[0m`);
  }
}

async function attachListeners() {
  unlistenData = await listen<{ id: number; data: string }>("pty-data", (e) => {
    if (e.payload.id !== myPtyId) return;
    term?.write(e.payload.data);
  });
  unlistenExit = await listen<{ id: number }>("pty-exit", (e) => {
    if (e.payload.id !== myPtyId) return;
    term?.writeln("\r\n\x1b[33m[process exited]\x1b[0m");
    myPtyId = null;
  });
}

function tryFit() {
  if (!fit) return;
  try {
    fit.fit();
  } catch {
    /* ignore */
  }
}

onMounted(async () => {
  if (!container.value) return;
  term = new Terminal({
    fontFamily: '"SF Mono", Menlo, Monaco, Consolas, "Courier New", monospace',
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
    if (myPtyId === null) return;
    invoke("pty_write", { id: myPtyId, data }).catch((e) =>
      console.error("pty_write failed", e)
    );
  });
  term.onResize(({ cols, rows }) => {
    if (myPtyId === null) return;
    invoke("pty_resize", { id: myPtyId, cols, rows }).catch((e) =>
      console.error("pty_resize failed", e)
    );
  });

  await attachListeners();
  resizeObs = new ResizeObserver(() => tryFit());
  resizeObs.observe(container.value);

  await waitForWorkspace(2000);
  tryFit();
  if (!spawned && term.cols > 1 && term.rows > 1) {
    spawned = true;
    await spawn();
  }
});

onBeforeUnmount(async () => {
  resizeObs?.disconnect();
  unlistenData?.();
  unlistenExit?.();
  if (myPtyId !== null) {
    try {
      await invoke("pty_kill", { id: myPtyId });
    } catch {
      /* ignore */
    }
  }
  term?.dispose();
});

watch(() => theme.theme, applyTheme);

watch(
  () => props.active,
  (a) => {
    if (a) {
      // Just became active — re-fit and focus.
      requestAnimationFrame(() => {
        tryFit();
        term?.focus();
      });
    }
  }
);
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
