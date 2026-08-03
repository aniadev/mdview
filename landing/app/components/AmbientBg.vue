<script setup lang="ts">
/**
 * Ambient page background — subtle depth behind the flat #1e1e1e.
 * Fixed layer, pointer-events none, sits at z-index -2 so it never
 * intercepts clicks. Purely decorative.
 */
</script>

<template>
  <div class="bg-fx" aria-hidden="true">
    <div class="grid" />
    <div class="orb orb-1" />
    <div class="orb orb-2" />
    <div class="orb orb-3" />
    <div class="vignette" />
  </div>
</template>

<style scoped>
.bg-fx {
  position: fixed;
  inset: 0;
  z-index: -2;
  overflow: hidden;
  pointer-events: none;
  background: var(--bg);
}

/* faint dev-tool grid, fading out toward the bottom */
.grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.028) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(ellipse 100% 65% at 50% 0%, #000 35%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 100% 65% at 50% 0%, #000 35%, transparent 100%);
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(110px);
  will-change: transform;
}

.orb-1 {
  width: 620px;
  height: 620px;
  background: rgba(0, 120, 212, 0.16);
  top: -240px;
  left: -140px;
  animation: drift-a 22s ease-in-out infinite alternate;
}

.orb-2 {
  width: 520px;
  height: 520px;
  background: rgba(64, 120, 200, 0.1);
  top: 6%;
  right: -180px;
  animation: drift-b 26s ease-in-out infinite alternate;
}

.orb-3 {
  width: 460px;
  height: 460px;
  background: rgba(0, 90, 170, 0.09);
  bottom: -180px;
  left: 34%;
  animation: drift-a 30s ease-in-out infinite alternate-reverse;
}

@keyframes drift-a {
  from {
    transform: translate(0, 0) scale(1);
  }
  to {
    transform: translate(70px, 50px) scale(1.14);
  }
}

@keyframes drift-b {
  from {
    transform: translate(0, 0) scale(1.05);
  }
  to {
    transform: translate(-60px, 40px) scale(0.95);
  }
}

.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 120% 80% at 50% 0%, transparent 40%, rgba(0, 0, 0, 0.45) 100%);
}
</style>
