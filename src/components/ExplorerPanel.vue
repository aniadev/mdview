<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "../stores/workspace";
import { useTabsStore } from "../stores/tabs";
import { useFsUiStore } from "../stores/fsui";
import FileTreeNode from "./FileTreeNode.vue";
import InlineFilenameInput from "./InlineFilenameInput.vue";

const workspace = useWorkspaceStore();
const tabs = useTabsStore();
const fsui = useFsUiStore();

const rootInputRef = ref<InstanceType<typeof InlineFilenameInput> | null>(null);

function onWindowClick() {
  if (fsui.ctxMenu.visible) fsui.closeContextMenu();
}

onMounted(() => window.addEventListener("click", onWindowClick));
onBeforeUnmount(() => window.removeEventListener("click", onWindowClick));

async function ctxNewFile() {
  fsui.requestCreateIn(
    fsui.ctxMenu.isDir
      ? fsui.ctxMenu.targetPath
      : parentOf(fsui.ctxMenu.targetPath)
  );
  fsui.closeContextMenu();
}

async function ctxRename() {
  fsui.requestRename(fsui.ctxMenu.targetPath);
  fsui.closeContextMenu();
}

async function ctxDelete() {
  const target = fsui.ctxMenu.targetPath;
  fsui.closeContextMenu();
  const ok = await confirm(
    `Delete "${baseName(target)}"? This cannot be undone.`,
    { title: "Delete file", kind: "warning" }
  );
  if (!ok) return;
  try {
    await workspace.deleteMdFile(target);
    tabs.handleFileDeleted(target);
  } catch (e) {
    workspace.error = String(e);
  }
}

function baseName(p: string) {
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] || p;
}

function parentOf(p: string) {
  const norm = p.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx >= 0 ? norm.slice(0, idx) : "";
}

async function onRootCreateCommit(rootPath: string, filename: string) {
  try {
    const newPath = await workspace.createMdFile(rootPath, filename);
    fsui.cancelInputs();
    const name = filename.toLowerCase().endsWith(".md")
      ? filename
      : `${filename}.md`;
    await tabs.openFile(newPath, name);
  } catch (e) {
    rootInputRef.value?.setError(String(e));
  }
}

function startRootCreate(rootPath: string) {
  fsui.requestCreateIn(rootPath);
}
</script>

<template>
  <div class="explorer-panel">
    <header class="sidebar-header">
      <span
        class="ws-name"
        :title="workspace.workspaceFile ?? workspace.rootPath ?? ''"
      >
        {{ workspace.hasWorkspace ? workspace.displayName : "Explorer" }}
      </span>
      <div class="sidebar-actions">
        <button
          v-if="!workspace.hasWorkspace"
          class="icon-btn"
          title="Add folder or .code-workspace"
          @click="workspace.addWorkspace()"
        >
          +
        </button>
        <button
          v-else
          class="icon-btn"
          title="Close workspace"
          @click="workspace.removeWorkspace()"
        >
          ×
        </button>
      </div>
    </header>

    <div class="sidebar-body">
      <div v-if="!workspace.hasWorkspace" class="sidebar-empty">
        <p>No folder opened.</p>
        <button class="primary" @click="workspace.addFolderDirect()">
          Add Folder
        </button>
        <button @click="workspace.addWorkspace()">Open Workspace…</button>
      </div>

      <template v-else>
        <div
          v-if="workspace.loading"
          class="sidebar-empty"
          style="height: auto; padding: 16px"
        >
          <p>Loading…</p>
        </div>
        <template v-else>
          <section
            v-for="root in workspace.roots"
            :key="root.path"
            class="ws-root"
          >
            <div class="ws-root-header">
              <span class="ws-root-name" :title="root.path">{{ root.name }}</span>
              <button
                class="icon-btn ws-root-add"
                title="New file in this root"
                @click="startRootCreate(root.path)"
              >
                +
              </button>
            </div>
            <div
              v-if="root.loadError"
              class="ws-root-error"
              :title="root.path"
            >
              {{ root.loadError }}
            </div>
            <ul v-else class="tree">
              <li
                v-if="fsui.pendingCreateInDir === root.path"
                class="tree-node"
              >
                <InlineFilenameInput
                  ref="rootInputRef"
                  :depth="0"
                  placeholder="filename.md"
                  @commit="(v) => onRootCreateCommit(root.path, v)"
                  @cancel="fsui.cancelInputs()"
                />
              </li>
              <FileTreeNode
                v-for="node in root.children"
                :key="node.path"
                :node="node"
                :depth="0"
              />
            </ul>
          </section>
          <div
            v-if="!workspace.hasAnyMd"
            class="sidebar-empty"
            style="height: auto; padding: 16px"
          >
            <p>No .md files found.</p>
          </div>
        </template>
      </template>
    </div>

    <Teleport to="body">
      <div
        v-if="fsui.ctxMenu.visible"
        class="ctx-menu"
        :style="{ left: fsui.ctxMenu.x + 'px', top: fsui.ctxMenu.y + 'px' }"
        @click.stop
      >
        <button v-if="fsui.ctxMenu.isDir" class="ctx-item" @click="ctxNewFile">
          New File
        </button>
        <button
          v-if="fsui.ctxMenu.isMdFile"
          class="ctx-item"
          @click="ctxRename"
        >
          Rename
        </button>
        <button
          v-if="fsui.ctxMenu.isMdFile"
          class="ctx-item"
          @click="ctxDelete"
        >
          Delete
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style>
.explorer-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.ws-root {
  margin-bottom: 4px;
}

.ws-root-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 4px 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.ws-root-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.ws-root-add {
  width: 18px;
  height: 18px;
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.1s;
}

.ws-root:hover .ws-root-add {
  opacity: 1;
}

.ws-root-error {
  padding: 6px 12px;
  font-size: 11px;
  color: var(--danger);
}
</style>
