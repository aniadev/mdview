<script setup lang="ts">
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent as RadixDialogContent,
} from 'radix-vue';
import { cn } from '@/utils/cn';

const props = defineProps<{
  open?: boolean;
  class?: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();
</script>

<template>
  <DialogRoot :open="props.open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[170] bg-black/45" />
      <RadixDialogContent
        :class="cn('fixed left-1/2 top-[12%] z-[180] -translate-x-1/2 rounded-[var(--radius)] border border-border bg-sidebar shadow-xl flex flex-col focus:outline-none', props.class)"
      >
        <slot />
      </RadixDialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
