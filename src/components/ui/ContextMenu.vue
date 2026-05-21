<script setup lang="ts">
import { ContextMenuContent, ContextMenuPortal } from 'radix-vue';
import { cn } from '@/utils/cn';

const props = defineProps<{ class?: string }>();
</script>

<template>
  <ContextMenuPortal>
    <ContextMenuContent
      :class="cn('z-50 min-w-[140px] overflow-hidden rounded-[var(--radius)] border border-border bg-sidebar p-1 shadow-md text-text text-[13px]', props.class)"
    >
      <slot />
    </ContextMenuContent>
  </ContextMenuPortal>
</template>
