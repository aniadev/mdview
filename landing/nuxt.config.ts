// Public production URL. NOTE: `mdview.vercel.app` was already taken by an
// unrelated project, so this deployment uses `mdviewz`. Change this (and
// public/robots.txt + public/sitemap.xml) if a custom domain is added later.
const SITE_URL = 'https://mdviewz.vercel.app'
const SITE_NAME = 'mdview'
const TITLE = 'mdview — Focused Markdown workspace editor'
const DESCRIPTION =
  'mdview is a focused Markdown workspace editor for developers, writers, and AI practitioners. Smart file tree, split-pane live preview, integrated terminal, graph view and backlinks — zero bloat. Free & open source (MIT) for macOS, Windows and Linux.'
const OG_IMAGE = `${SITE_URL}/og-image.png`

// Google Search Console verification token.
// Get it at https://search.google.com/search-console → Add property →
// URL prefix → HTML tag, then copy ONLY the content="..." value here
// (or set NUXT_PUBLIC_GOOGLE_SITE_VERIFICATION in the Vercel env vars).
// Leaving it empty simply omits the tag — the site still gets indexed via
// robots.txt + sitemap.xml, verification just unlocks Search Console data.
const GOOGLE_SITE_VERIFICATION = process.env.NUXT_PUBLIC_GOOGLE_SITE_VERIFICATION || ''

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
        { name: 'application-name', content: SITE_NAME },

        // Crawling directives — allow full indexing and rich previews
        {
          name: 'robots',
          content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
        },
        {
          name: 'googlebot',
          content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
        },

        // Google Search Console ownership (omitted when the token is empty)
        ...(GOOGLE_SITE_VERIFICATION
          ? [{ name: 'google-site-verification', content: GOOGLE_SITE_VERIFICATION }]
          : []),

        // Open Graph
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: SITE_NAME },
        { property: 'og:url', content: SITE_URL },
        { property: 'og:title', content: TITLE },
        { property: 'og:description', content: DESCRIPTION },
        { property: 'og:image', content: OG_IMAGE },
        { property: 'og:image:type', content: 'image/png' },
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
        { rel: 'alternate', hreflang: 'en', href: SITE_URL },
        { rel: 'alternate', hreflang: 'x-default', href: SITE_URL },
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
            '@graph': [
              {
                '@type': 'SoftwareApplication',
                '@id': `${SITE_URL}/#app`,
                name: 'mdview',
                alternateName: 'mdview Markdown editor',
                description: DESCRIPTION,
                url: SITE_URL,
                applicationCategory: 'DeveloperApplication',
                applicationSubCategory: 'Text Editor',
                operatingSystem: 'macOS, Windows, Linux',
                softwareVersion: '1.8.0',
                license: 'https://opensource.org/licenses/MIT',
                downloadUrl: 'https://github.com/aniadev/mdview/releases',
                installUrl: 'https://github.com/aniadev/mdview/releases',
                image: OG_IMAGE,
                screenshot: OG_IMAGE,
                isAccessibleForFree: true,
                featureList: [
                  'Smart file tree that dims folders without Markdown',
                  'Split-pane editor with live GitHub Flavored Markdown preview',
                  'KaTeX math and Mermaid diagrams',
                  'Integrated PTY terminal with multiple sessions',
                  'Command palette and multi-threaded workspace search',
                  'Wikilinks, backlinks and D3 force-directed graph view',
                  'Daily notes and AI agent instruction file recognition',
                ],
                offers: {
                  '@type': 'Offer',
                  price: '0',
                  priceCurrency: 'USD',
                  availability: 'https://schema.org/InStock',
                },
                author: { '@id': `${SITE_URL}/#author` },
                publisher: { '@id': `${SITE_URL}/#author` },
              },
              {
                '@type': 'WebSite',
                '@id': `${SITE_URL}/#website`,
                url: SITE_URL,
                name: SITE_NAME,
                description: DESCRIPTION,
                inLanguage: 'en',
                publisher: { '@id': `${SITE_URL}/#author` },
              },
              {
                '@type': 'Person',
                '@id': `${SITE_URL}/#author`,
                name: 'aniadev',
                url: 'https://github.com/aniadev',
                sameAs: ['https://github.com/aniadev', 'https://github.com/aniadev/mdview'],
              },
            ],
          }),
        },
      ],
    },
  },
})
