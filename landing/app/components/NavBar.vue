<script setup lang="ts">
import { Icon } from '@iconify/vue'

const links = [
  { href: '#features', label: 'Features' },
  { href: '#shortcuts', label: 'Shortcuts' },
  { href: '#graph', label: 'Graph View' },
  { href: '#download', label: 'Download' },
]

const GITHUB = 'https://github.com/aniadev/mdview'

const scrolled = ref(false)

function onScroll() {
  scrolled.value = window.scrollY > 24
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <nav :class="{ scrolled }">
    <div class="wrap nav-in">
      <a class="logo" href="#top">
        <img src="/mdview-logo.png" alt="mdview logo" class="mark" width="26" height="26" />
        mdview
      </a>
      <div class="nav-links">
        <a v-for="l in links" :key="l.href" :href="l.href">{{ l.label }}</a>
      </div>
      <div class="nav-right">
        <a
          class="btn btn-ghost btn-sm"
          :href="GITHUB"
          target="_blank"
          rel="noopener"
          aria-label="Star mdview on GitHub — open source Markdown editor repository"
          title="mdview on GitHub"
        >
          <Icon icon="lucide:star" width="13" height="13" /> Star
        </a>
        <a class="btn btn-primary btn-sm" href="#download">
          <Icon icon="lucide:download" width="13" height="13" /> Download
        </a>
      </div>
    </div>
  </nav>
</template>

<style scoped>
nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(30, 30, 30, 0.55);
  backdrop-filter: blur(14px) saturate(140%);
  border-bottom: 1px solid transparent;
  transition:
    background 0.35s var(--ease-out),
    border-color 0.35s var(--ease-out),
    box-shadow 0.35s var(--ease-out);
}

nav.scrolled {
  background: rgba(24, 24, 24, 0.82);
  border-bottom-color: var(--border);
  box-shadow: 0 6px 26px rgba(0, 0, 0, 0.34);
}

.nav-in {
  display: flex;
  align-items: center;
  gap: 28px;
  height: 66px;
  transition: height 0.35s var(--ease-out);
}

nav.scrolled .nav-in {
  height: 56px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 15.5px;
  color: #fff;
  letter-spacing: -0.2px;
}

.logo:hover {
  text-decoration: none;
}

.mark {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: block;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.07);
  transition: transform 0.4s var(--ease-spring);
}

.logo:hover .mark {
  transform: rotate(-8deg) scale(1.08);
}

.nav-links {
  display: flex;
  gap: 24px;
  font-size: 13.5px;
}

.nav-links a {
  position: relative;
  color: var(--muted);
  padding: 4px 0;
  transition: color 0.25s var(--ease-out);
}

/* animated underline */
.nav-links a::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  height: 1.5px;
  width: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-hi));
  transform: scaleX(0);
  transform-origin: 100% 50%;
  transition: transform 0.35s var(--ease-out);
}

.nav-links a:hover {
  color: #fff;
  text-decoration: none;
}

.nav-links a:hover::after {
  transform: scaleX(1);
  transform-origin: 0 50%;
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
