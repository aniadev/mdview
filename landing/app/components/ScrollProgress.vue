<script setup lang="ts">
/** Thin gradient bar at the very top showing read progress. */
const progress = ref(0)

function onScroll() {
  const doc = document.documentElement
  const max = doc.scrollHeight - doc.clientHeight
  progress.value = max > 0 ? Math.min(1, doc.scrollTop / max) : 0
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <div class="progress" aria-hidden="true">
    <div class="bar" :style="{ transform: `scaleX(${progress})` }" />
  </div>
</template>

<style scoped>
.progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 100;
  pointer-events: none;
}

.bar {
  height: 100%;
  width: 100%;
  transform-origin: 0 50%;
  transform: scaleX(0);
  background: linear-gradient(90deg, var(--accent), var(--accent-hi), #7ee7ff);
  box-shadow: 0 0 12px rgba(77, 170, 252, 0.6);
  transition: transform 0.1s linear;
}
</style>
