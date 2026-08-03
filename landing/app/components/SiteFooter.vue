<script setup lang="ts">
const year = new Date().getFullYear()

const REPO = 'https://github.com/aniadev/mdview'

const links = [
  { href: REPO, label: 'GitHub', aria: 'mdview source code on GitHub' },
  {
    href: `${REPO}/blob/main/CHANGELOG.md`,
    label: 'Changelog',
    aria: 'mdview changelog on GitHub',
  },
  { href: `${REPO}/releases`, label: 'Releases', aria: 'mdview releases and installers on GitHub' },
]
</script>

<template>
  <footer>
    <div class="wrap">
      <!-- open-source block: gives crawlers descriptive anchor text -->
      <div class="foot-top">
        <div class="foot-brand">
          <img src="/mdview-logo.png" alt="mdview logo" width="28" height="28" />
          <div>
            <strong>mdview</strong>
            <p>
              A free, open source Markdown editor for macOS, Windows and Linux — built with
              Tauri 2, Vue 3 and Rust.
            </p>
          </div>
        </div>
        <p class="foot-oss">
          mdview is open source under the MIT license. Read the code, report an issue or
          contribute on
          <a
            :href="REPO"
            target="_blank"
            rel="noopener"
            aria-label="mdview source code on GitHub"
          >the mdview GitHub repository</a>, browse the
          <a
            :href="`${REPO}/blob/main/CHANGELOG.md`"
            target="_blank"
            rel="noopener"
            aria-label="mdview changelog on GitHub"
          >full changelog</a>, or grab an installer from
          <a
            :href="`${REPO}/releases`"
            target="_blank"
            rel="noopener"
            aria-label="Download mdview installers from GitHub Releases"
          >GitHub Releases</a>.
        </p>
      </div>

      <div class="foot-in">
        <span class="mono">mdview v1.8.0 · © {{ year }}</span>
        <span>MIT License · built with Tauri 2 · Vue 3 · Rust</span>
        <div class="foot-links">
          <a
            v-for="l in links"
            :key="l.label"
            :href="l.href"
            target="_blank"
            rel="noopener"
            :aria-label="l.aria"
          >{{ l.label }}</a>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
footer {
  border-top: 1px solid var(--border);
  padding: 48px 0 36px;
  color: var(--dim);
  font-size: 13px;
}

.foot-top {
  display: grid;
  grid-template-columns: minmax(220px, 300px) 1fr;
  gap: 48px;
  align-items: start;
  padding-bottom: 30px;
  margin-bottom: 26px;
  border-bottom: 1px solid var(--border);
}

.foot-brand {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.foot-brand img {
  border-radius: 6px;
  flex: none;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.07);
}

.foot-brand strong {
  color: #fff;
  font-size: 14.5px;
  display: block;
  margin-bottom: 4px;
}

.foot-brand p {
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.6;
}

.foot-oss {
  color: var(--muted);
  font-size: 13.5px;
  line-height: 1.75;
  max-width: 620px;
}

.foot-oss a {
  color: var(--accent-hi);
}

@media (max-width: 860px) {
  .foot-top {
    grid-template-columns: 1fr;
    gap: 24px;
  }
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
