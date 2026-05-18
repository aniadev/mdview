<script setup lang="ts">
import { useWorkspaceStore } from "../stores/workspace";
import { useThemeStore } from "../stores/theme";
import FileTreeNode from "./FileTreeNode.vue";

const workspace = useWorkspaceStore();
const theme = useThemeStore();
</script>

<template>
  <aside class="sidebar">
    <header class="sidebar-header">
      <span class="ws-name" :title="workspace.rootPath ?? ''">
        {{ workspace.hasWorkspace ? workspace.rootName : "Explorer" }}
      </span>
      <div class="sidebar-actions">
        <button
          class="icon-btn"
          :title="theme.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
          @click="theme.toggle()"
        >
          {{ theme.theme === "dark" ? "☀" : "☾" }}
        </button>
        <button
          v-if="!workspace.hasWorkspace"
          class="icon-btn"
          title="Add folder"
          @click="workspace.addWorkspace()"
        >
          +
        </button>
        <button
          v-else
          class="icon-btn"
          title="Close folder"
          @click="workspace.removeWorkspace()"
        >
          ×
        </button>
      </div>
    </header>

    <div class="sidebar-body">
      <div v-if="!workspace.hasWorkspace" class="sidebar-empty">
        <p>No folder opened.</p>
        <button class="primary" @click="workspace.addWorkspace()">
          Add Folder
        </button>
      </div>

      <template v-else>
        <div
          v-if="workspace.loading"
          class="sidebar-empty"
          style="height: auto; padding: 16px"
        >
          <p>Loading…</p>
        </div>
        <ul v-else class="tree">
          <FileTreeNode
            v-for="node in workspace.rootChildren"
            :key="node.path"
            :node="node"
            :depth="0"
          />
        </ul>
        <div
          v-if="!workspace.loading && !workspace.hasAnyMd"
          class="sidebar-empty"
          style="height: auto; padding: 16px"
        >
          <p>No .md files found.</p>
        </div>
      </template>
    </div>
  </aside>
</template>
