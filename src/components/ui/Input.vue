<script setup lang="ts">
import { ref } from 'vue';
import { cn } from '@/utils/cn';

const props = defineProps<{
  class?: string;
}>();

const inputEl = ref<HTMLInputElement | null>(null);

defineExpose({
  focus: () => inputEl.value?.focus(),
  select: () => inputEl.value?.select(),
  setSelectionRange: (start: number, end: number) => inputEl.value?.setSelectionRange(start, end),
  get value() { return inputEl.value; },
});
</script>

<template>
  <input
    ref="inputEl"
    v-bind="$attrs"
    :class="cn('flex h-8 w-full rounded-[var(--radius)] border border-border bg-transparent px-2 py-1 text-[13px] text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50', props.class)"
  />
</template>
