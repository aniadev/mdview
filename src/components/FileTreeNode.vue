<script setup lang="ts">
import { computed, ref } from "vue";
import { Icon } from "@iconify/vue";
import type { TreeNode } from "../types";
import { useWorkspaceStore } from "../stores/workspace";
import { useTabsStore } from "../stores/tabs";
import { useFsUiStore } from "../stores/fsui";
import InlineFilenameInput from "./InlineFilenameInput.vue";

const props = defineProps<{
  node: TreeNode;
  depth: number;
}>();

const workspace = useWorkspaceStore();
const tabs = useTabsStore();
const fsui = useFsUiStore();

const indent = computed(() => `${props.depth * 12 + 4}px`);
const isMdFile = computed(() => !props.node.is_dir && props.node.has_md);
const dim = computed(() => !props.node.has_md);
const selected = computed(
  () => !props.node.is_dir && tabs.activePath === props.node.path
);

const inputRef = ref<InstanceType<typeof InlineFilenameInput> | null>(null);

const showCreateChild = computed(
  () =>
    props.node.is_dir &&
    props.node.expanded &&
    fsui.pendingCreateInDir === props.node.path
);

const showCreateDirChild = computed(
  () =>
    props.node.is_dir &&
    props.node.expanded &&
    fsui.pendingCreateDirInDir === props.node.path
);

const showRename = computed(() => fsui.pendingRenamePath === props.node.path);

async function onRowClick() {
  if (props.node.is_dir) {
    await workspace.toggleDir(props.node);
  } else if (isMdFile.value) {
    tabs.openFile(props.node.path, props.node.name);
  }
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  fsui.openContextMenu(e, {
    path: props.node.path,
    is_dir: props.node.is_dir,
    has_md: props.node.has_md,
  });
}

async function onCreateCommit(filename: string) {
  const parent = props.node.path;
  try {
    if (!props.node.expanded) await workspace.toggleDir(props.node);
    const newPath = await workspace.createMdFile(parent, filename);
    fsui.cancelInputs();
    const base = newPath.replace(/\\/g, "/").split("/").pop() ?? filename;
    await tabs.openFile(newPath, base);
  } catch (e) {
    inputRef.value?.setError(String(e));
  }
}

async function onCreateDirCommit(name: string) {
  const parent = props.node.path;
  try {
    if (!props.node.expanded) await workspace.toggleDir(props.node);
    await workspace.createDir(parent, name);
    fsui.cancelInputs();
  } catch (e) {
    inputRef.value?.setError(String(e));
  }
}

async function onRenameCommit(filename: string) {
  try {
    const oldPath = props.node.path;
    const newPath = await workspace.renameMdFile(oldPath, filename);
    const newName = filename.toLowerCase().endsWith(".md")
      ? filename
      : `${filename}.md`;
    tabs.handleFileRenamed(oldPath, newPath, newName);
    fsui.cancelInputs();
  } catch (e) {
    inputRef.value?.setError(String(e));
  }
}
</script>

<template>
  <li class="tree-node">
    <template v-if="!showRename">
      <div
        class="tree-row"
        :class="{ dim, selected }"
        :style="{ paddingLeft: indent }"
        @click="onRowClick"
        @contextmenu="onContextMenu"
      >
        <span class="tree-chevron">
          <Icon v-if="node.is_dir" :icon="node.expanded ? 'lucide:chevron-down' : 'lucide:chevron-right'" width="12" height="12" />
        </span>
        <span class="tree-icon">
          <Icon v-if="node.is_dir" :icon="node.expanded ? 'lucide:folder-open' : 'lucide:folder'" width="14" height="14" />
          <Icon v-else-if="isMdFile" icon="lucide:file-text" width="14" height="14" />
          <Icon v-else icon="lucide:file" width="14" height="14" />
        </span>
        <span class="tree-name">{{ node.name }}</span>
      </div>
    </template>
    <template v-else>
      <InlineFilenameInput
        ref="inputRef"
        :initial="node.name"
        :depth="depth"
        placeholder="new name"
        @commit="onRenameCommit"
        @cancel="fsui.cancelInputs()"
      />
    </template>

    <ul
      v-if="node.is_dir && node.expanded && (node.children || showCreateChild || showCreateDirChild)"
      class="tree-children"
    >
      <li v-if="showCreateChild" class="tree-node">
        <InlineFilenameInput
          ref="inputRef"
          :depth="depth + 1"
          placeholder="filename.md"
          @commit="onCreateCommit"
          @cancel="fsui.cancelInputs()"
        />
      </li>
      <li v-if="showCreateDirChild" class="tree-node">
        <InlineFilenameInput
          ref="inputRef"
          :depth="depth + 1"
          placeholder="folder-name"
          @commit="onCreateDirCommit"
          @cancel="fsui.cancelInputs()"
        />
      </li>
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
      />
    </ul>
  </li>
</template>
