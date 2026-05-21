<script setup lang="ts">
import { ContextMenuSeparator } from 'radix-vue';
import { cn } from '@/utils/cn';

const props = defineProps<{ class?: string }>();
</script>

<template>
  <ContextMenuSeparator :class="cn('my-1 h-px bg-border', props.class)" />
</template>
