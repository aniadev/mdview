<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import UiInput from "./ui/Input.vue";

const props = defineProps<{
  initial?: string;
  depth: number;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: "commit", value: string): void;
  (e: "cancel"): void;
}>();

const value = ref(props.initial ?? "");
const input = ref<InstanceType<typeof UiInput> | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  await nextTick();
  input.value?.focus();
  if (props.initial) {
    // Select base name (without .md) so user can quickly retype
    const dot = props.initial.lastIndexOf(".");
    const end = dot > 0 ? dot : props.initial.length;
    input.value?.setSelectionRange(0, end);
  }
});

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    commit();
  } else if (e.key === "Escape") {
    e.preventDefault();
    cancelledByEscape = true;
    emit("cancel");
  }
}

function commit() {
  const v = value.value.trim();
  if (!v) {
    emit("cancel");
    return;
  }
  emit("commit", v);
}

let cancelledByEscape = false;
function onBlur() {
  if (cancelledByEscape) return;
  if (value.value.trim()) commit();
  else emit("cancel");
}

defineExpose({
  setError(msg: string) {
    error.value = msg;
    nextTick(() => input.value?.focus());
  },
});
</script>

<template>
  <div class="inline-input-wrap" :style="{ paddingLeft: depth * 12 + 24 + 'px' }">
    <UiInput
      ref="input"
      v-model="value"
      class="inline-input"
      :placeholder="placeholder ?? 'filename.md'"
      spellcheck="false"
      @keydown="onKeydown"
      @blur="onBlur"
      @click.stop
    />
    <div v-if="error" class="inline-input-error">{{ error }}</div>
  </div>
</template>

<style>
.inline-input-wrap {
  padding: 2px 8px 2px 4px;
}
.inline-input {
  width: 100%;
  background: var(--bg-app);
  border: 1px solid var(--accent);
  color: var(--text);
  padding: 2px 6px;
  font-size: 13px;
  font-family: inherit;
  border-radius: 2px;
  outline: none;
}
.inline-input-error {
  color: var(--danger);
  font-size: 11px;
  margin-top: 2px;
}
</style>
