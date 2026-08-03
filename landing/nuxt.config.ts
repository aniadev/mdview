// Public production URL. NOTE: `mdview.vercel.app` is already taken by an
// unrelated project, so the canonical host is the alias Vercel assigned to
// this project. Change this (and public/robots.txt + public/sitemap.xml) if a
// custom domain is added later.
const SITE_URL = 'https://landing-iota-six-87.vercel.app'
const SITE_NAME = 'mdview'
const TITLE = 'mdview — Focused Markdown workspace editor'
const DESCRIPTION =
  'mdview is a focused Markdown workspace editor for developers, writers, and AI practitioners. Smart file tree, split-pane live preview, integrated terminal, graph view and backlinks — zero bloat. Free & open source (MIT) for macOS, Windows and Linux.'
const OG_IMAGE = `${SITE_URL}/og-image.png`

export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',

  devtools: { enabled: false },

  css: ['~/assets/css/main.css'],

  // Pre-render the landing page to static HTML — best TTFB + crawlability.
  nitro: {
    preset: 'vercel',
    prerender: {
      crawlLinks: true,
      routes: ['/', '/robots.txt', '/sitemap.xml'],
    },
  },

  runtimeConfig: {
    public: {
      siteUrl: SITE_URL,
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en', 'data-theme': 'dark' },
      title: TITLE,
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: DESCRIPTION },
        {
          name: 'keywords',
          content:
            'markdown editor, markdown workspace, desktop markdown app, tauri markdown editor, GFM preview, mermaid diagrams, KaTeX, wikilinks, backlinks, graph view, daily notes, CLAUDE.md, AGENTS.md, AI agent instructions',
        },
        { name: 'author', content: 'aniadev' },
        { name: 'theme-color', content: '#1e1e1e' },
        { name: 'color-scheme', content: 'dark' },

        // Open Graph
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: SITE_NAME },
        { property: 'og:url', content: SITE_URL },
        { property: 'og:title', content: TITLE },
        { property: 'og:description', content: DESCRIPTION },
        { property: 'og:image', content: OG_IMAGE },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'mdview — focused Markdown workspace editor' },
        { property: 'og:locale', content: 'en_US' },

        // Twitter / X
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: TITLE },
        { name: 'twitter:description', content: DESCRIPTION },
        { name: 'twitter:image', content: OG_IMAGE },
        { name: 'twitter:image:alt', content: 'mdview — focused Markdown workspace editor' },
      ],
      link: [
        { rel: 'canonical', href: SITE_URL },
        { rel: 'icon', type: 'image/png', href: '/mdview-logo.png' },
        { rel: 'apple-touch-icon', href: '/mdview-logo.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap',
        },
      ],
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'mdview',
            description: DESCRIPTION,
            url: SITE_URL,
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'macOS, Windows, Linux',
            softwareVersion: '1.8.0',
            license: 'https://opensource.org/licenses/MIT',
            downloadUrl: 'https://github.com/aniadev/mdview/releases',
            image: OG_IMAGE,
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            author: {
              '@type': 'Person',
              name: 'aniadev',
              url: 'https://github.com/aniadev',
            },
          }),
        },
      ],
    },
  },
})
