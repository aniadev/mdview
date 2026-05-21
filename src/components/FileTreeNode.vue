<script setup lang="ts">
import { computed, ref } from "vue";
import { Icon } from "@iconify/vue";
import type { TreeNode } from "../types";
import { useWorkspaceStore } from "../stores/workspace";
import { useTabsStore } from "../stores/tabs";
import { useFsUiStore } from "../stores/fsui";
import { isAgentFile } from "../utils/agentFiles";
import InlineFilenameInput from "./InlineFilenameInput.vue";
import { useI18n } from "../i18n";

const { t } = useI18n();

const props = defineProps<{
  node: TreeNode;
  depth: number;
}>();

const workspace = useWorkspaceStore();
const tabs = useTabsStore();
const fsui = useFsUiStore();

const indent = computed(() => `${props.depth * 12 + 4}px`);
const isMdFile = computed(() => !props.node.is_dir && props.node.has_md);
const isAgent = computed(() => isMdFile.value && isAgentFile(props.node.name));
const dim = computed(() => !props.node.has_md);
const selected = computed(
  () => !props.node.is_dir && tabs.activePath === props.node.path
);
const multiSelected = computed(() => fsui.isMultiSelected(props.node.path));


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

async function onRowClick(e: MouseEvent) {
  if (e.metaKey || e.ctrlKey) {
    fsui.toggleSelection(props.node.path, props.node.is_dir);
    return;
  }
  // Normal click: clear multi-selection, select this node
  fsui.selectOne(props.node.path, props.node.is_dir);
  if (props.node.is_dir) {
    await workspace.toggleDir(props.node);
  } else if (isMdFile.value) {
    tabs.openFile(props.node.path, props.node.name);
  }
}

function onContextMenu(e: MouseEvent) {
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
  <!-- tree-node -->
  <li class="select-none">
    <template v-if="!showRename">
      <!-- tree-row -->
      <div
        class="tree-row flex items-center gap-1 pr-2 cursor-pointer whitespace-nowrap text-[13px] leading-[22px] rounded-[3px] hover:bg-[var(--bg-hover)]"
        :class="{ dim: dim, selected: selected, 'multi-selected': multiSelected }"
        :style="{ paddingLeft: indent }"
        @click="onRowClick"
        @contextmenu="onContextMenu"
      >
        <!-- tree-chevron -->
        <span class="w-4 text-center text-[var(--text-muted)] text-[10px] flex-[0_0_16px] select-none">
          <Icon v-if="node.is_dir" :icon="node.expanded ? 'lucide:chevron-down' : 'lucide:chevron-right'" width="12" height="12" />
        </span>
        <!-- tree-icon -->
        <span class="w-4 text-center flex-[0_0_16px] text-[var(--text-muted)] select-none">
          <Icon v-if="node.is_dir" :icon="node.expanded ? 'lucide:folder-open' : 'lucide:folder'" width="14" height="14" />
          <Icon v-else-if="isAgent" icon="lucide:bot" width="14" height="14" :style="{ color: 'var(--accent)' }" />
          <Icon v-else-if="isMdFile" icon="lucide:file-text" width="14" height="14" />
          <Icon v-else icon="lucide:file" width="14" height="14" />
        </span>
        <!-- tree-name -->
        <span class="overflow-hidden text-ellipsis whitespace-nowrap select-none">{{ node.name }}</span>
      </div>
    </template>
    <template v-else>
      <InlineFilenameInput
        ref="inputRef"
        :initial="node.name"
        :depth="depth"
        :placeholder="t('input.rename')"
        @commit="onRenameCommit"
        @cancel="fsui.cancelInputs()"
      />
    </template>

    <!-- tree-children -->
    <ul
      v-if="node.is_dir && node.expanded && (node.children || showCreateChild || showCreateDirChild)"
      class="list-none m-0 p-0"
    >
      <li v-if="showCreateChild" class="select-none">
        <InlineFilenameInput
          ref="inputRef"
          :depth="depth + 1"
          :placeholder="t('input.filename')"
          @commit="onCreateCommit"
          @cancel="fsui.cancelInputs()"
        />
      </li>
      <li v-if="showCreateDirChild" class="select-none">
        <InlineFilenameInput
          ref="inputRef"
          :depth="depth + 1"
          :placeholder="t('input.foldername')"
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

<style lang="scss" scoped>
/* Selected/multi-selected states use CSS custom properties — kept in scoped style */
.tree-row {
  &.selected {
    background: var(--bg-selected);
  }

  &.multi-selected {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    outline: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    outline-offset: -1px;
  }

  &.dim {
    opacity: 0.4;
  }
}
</style>
