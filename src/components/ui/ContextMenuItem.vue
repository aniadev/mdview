<script setup lang="ts">
import { ContextMenuItem } from 'radix-vue';
import { cn } from '@/utils/cn';

const props = defineProps<{ class?: string; disabled?: boolean }>();
</script>

<template>
  <ContextMenuItem
    :disabled="props.disabled"
    :class="cn('flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 outline-none hover:bg-hover focus:bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-40', props.class)"
  >
    <slot />
  </ContextMenuItem>
</template>
