<script setup lang="ts">
import { computed } from "vue";
import type { TreeNode } from "../types";
import { useWorkspaceStore } from "../stores/workspace";
import { useTabsStore } from "../stores/tabs";

const props = defineProps<{
  node: TreeNode;
  depth: number;
}>();

const workspace = useWorkspaceStore();
const tabs = useTabsStore();

const indent = computed(() => `${props.depth * 12 + 4}px`);
const isMdFile = computed(() => !props.node.is_dir && props.node.has_md);
const dim = computed(() => !props.node.has_md);
const selected = computed(
  () => !props.node.is_dir && tabs.activePath === props.node.path
);

async function onRowClick() {
  if (props.node.is_dir) {
    await workspace.toggleDir(props.node);
  } else if (isMdFile.value) {
    tabs.openFile(props.node.path, props.node.name);
  }
}
</script>

<template>
  <li class="tree-node">
    <div
      class="tree-row"
      :class="{ dim, selected }"
      :style="{ paddingLeft: indent }"
      @click="onRowClick"
    >
      <span class="tree-chevron">
        <template v-if="node.is_dir">{{ node.expanded ? "▾" : "▸" }}</template>
      </span>
      <span class="tree-icon">
        <template v-if="node.is_dir">{{ node.expanded ? "📂" : "📁" }}</template>
        <template v-else-if="isMdFile">📄</template>
        <template v-else>·</template>
      </span>
      <span class="tree-name">{{ node.name }}</span>
    </div>
    <ul
      v-if="node.is_dir && node.expanded && node.children"
      class="tree-children"
    >
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
      />
    </ul>
  </li>
</template>
