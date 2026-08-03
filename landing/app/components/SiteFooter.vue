<script setup lang="ts">
const year = new Date().getFullYear()

const links = [
  { href: 'https://github.com/aniadev/mdview', label: 'GitHub' },
  { href: 'https://github.com/aniadev/mdview/blob/main/CHANGELOG.md', label: 'Changelog' },
  { href: 'https://github.com/aniadev/mdview/releases', label: 'Releases' },
]
</script>

<template>
  <footer>
    <div class="wrap foot-in">
      <span class="mono">mdview v1.8.0</span>
      <span>MIT License · built with Tauri 2 · Vue 3 · Rust</span>
      <div class="foot-links">
        <a v-for="l in links" :key="l.label" :href="l.href" target="_blank" rel="noopener">{{ l.label }}</a>
      </div>
    </div>
  </footer>
</template>

<style scoped>
footer {
  border-top: 1px solid var(--border);
  padding: 36px 0;
  color: var(--dim);
  font-size: 13px;
}

.foot-in {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.foot-in .mono {
  color: var(--muted);
}

.foot-links {
  margin-left: auto;
  display: flex;
  gap: 20px;
}

.foot-links a {
  color: var(--muted);
}

.foot-links a:hover {
  color: #fff;
  text-decoration: none;
}
</style>
