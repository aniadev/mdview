<script setup lang="ts">
import { Icon } from '@iconify/vue'

const links = [
  { href: '#features', label: 'Features' },
  { href: '#shortcuts', label: 'Shortcuts' },
  { href: '#graph', label: 'Graph View' },
  { href: '#download', label: 'Download' },
]

const GITHUB = 'https://github.com/aniadev/mdview'
</script>

<template>
  <nav>
    <div class="wrap nav-in">
      <a class="logo" href="#top">
        <img src="/mdview-logo.png" alt="mdview logo" class="mark" width="24" height="24" />
        mdview
      </a>
      <div class="nav-links">
        <a v-for="l in links" :key="l.href" :href="l.href">{{ l.label }}</a>
      </div>
      <div class="nav-right">
        <a class="btn btn-ghost btn-sm" :href="GITHUB" target="_blank" rel="noopener">
          <Icon icon="lucide:star" width="13" height="13" /> Star on GitHub
        </a>
        <a class="btn btn-primary btn-sm" href="#download">Download</a>
      </div>
    </div>
  </nav>
</template>

<style scoped>
nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(30, 30, 30, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.nav-in {
  display: flex;
  align-items: center;
  gap: 28px;
  height: 56px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 9px;
  font-weight: 700;
  font-size: 15px;
  color: #fff;
}

.logo:hover {
  text-decoration: none;
}

.mark {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  display: block;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.nav-links {
  display: flex;
  gap: 22px;
  font-size: 13.5px;
}

.nav-links a {
  color: var(--muted);
}

.nav-links a:hover {
  color: #fff;
  text-decoration: none;
}

.nav-right {
  margin-left: auto;
  display: flex;
  gap: 10px;
  align-items: center;
}

@media (max-width: 640px) {
  .nav-links {
    display: none;
  }
}
</style>
