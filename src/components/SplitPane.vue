<script setup lang="ts">
import { ref, onBeforeUnmount } from "vue";

const props = defineProps<{
  initial?: number;
  min?: number;
  max?: number;
}>();

const emit = defineEmits<{
  (e: "update:ratio", value: number): void;
}>();

const ratio = ref(props.initial ?? 0.5);
const container = ref<HTMLDivElement | null>(null);
const dragging = ref(false);

function onPointerDown(e: PointerEvent) {
  dragging.value = true;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp, { once: true });
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || !container.value) return;
  const rect = container.value.getBoundingClientRect();
  const x = e.clientX - rect.left;
  let next = x / rect.width;
  const min = props.min ?? 0.15;
  const max = props.max ?? 0.85;
  if (next < min) next = min;
  if (next > max) next = max;
  ratio.value = next;
  emit("update:ratio", next);
}

function onPointerUp() {
  dragging.value = false;
  window.removeEventListener("pointermove", onPointerMove);
}

onBeforeUnmount(() => {
  window.removeEventListener("pointermove", onPointerMove);
});
</script>

<template>
  <div ref="container" class="split-pane" :class="{ dragging }">
    <div class="split-left" :style="{ flexBasis: `${ratio * 100}%` }">
      <slot name="left" />
    </div>
    <div
      class="split-divider"
      @pointerdown="onPointerDown"
      role="separator"
      aria-orientation="vertical"
    ></div>
    <div class="split-right">
      <slot name="right" />
    </div>
  </div>
</template>

<style>
.split-pane {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.split-pane.dragging {
  cursor: col-resize;
  user-select: none;
}

.split-left,
.split-right {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.split-left {
  flex-grow: 0;
  flex-shrink: 0;
}

.split-divider {
  flex: 0 0 4px;
  background: var(--border);
  cursor: col-resize;
  position: relative;
}

.split-divider:hover,
.split-pane.dragging .split-divider {
  background: var(--accent);
}
</style>
