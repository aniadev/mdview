<script setup lang="ts">
import { computed } from "vue";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none border border-transparent text-xs",
  {
    variants: {
      variant: {
        default: "bg-accent border-accent text-white hover:bg-[#1187dd]",
        destructive: "bg-danger border-danger text-white hover:opacity-90",
        outline: "border-border bg-transparent text-text hover:bg-hover",
        secondary: "bg-hover border-border text-text hover:opacity-90",
        ghost: "border-none text-text-muted hover:bg-hover hover:text-text",
        link: "text-accent border-none p-0 bg-transparent hover:underline",
      },
      size: {
        default: "px-3 py-[5px]",
        sm: "px-2 py-1 text-[11px]",
        lg: "px-4 py-2",
        icon: "h-[22px] w-[22px] p-0 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  class?: string;
  as?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: "default",
  size: "default",
  as: "button",
  disabled: false,
});

const buttonClass = computed(() => {
  return cn(buttonVariants({ variant: props.variant, size: props.size }), props.class);
});
</script>

<template>
  <component
    :is="props.as"
    :class="buttonClass"
    :disabled="props.disabled"
  >
    <slot />
  </component>
</template>
