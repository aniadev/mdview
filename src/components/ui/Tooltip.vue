<script setup lang="ts">
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent as RadixTooltipContent,
} from 'radix-vue';
import { cn } from '@/utils/cn';

const props = defineProps<{
  content: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  class?: string;
  delayDuration?: number;
}>();
</script>

<template>
  <TooltipProvider :delay-duration="props.delayDuration ?? 400">
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <RadixTooltipContent
          :side="props.side ?? 'bottom'"
          :class="cn('z-50 rounded-[var(--radius)] bg-sidebar border border-border px-2 py-1 text-[11px] text-text shadow-md select-none', props.class)"
        >
          {{ props.content }}
        </RadixTooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
