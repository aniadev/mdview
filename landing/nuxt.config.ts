export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',

  devtools: { enabled: false },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'en', 'data-theme': 'dark' },
      title: 'mdview — Focused Markdown workspace editor',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'mdview is a focused Markdown workspace editor for developers, writers, and AI practitioners. Smart file tree, split-pane live preview, integrated terminal — zero bloat. Free & open source (MIT).',
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'mdview — Focused Markdown workspace editor' },
        {
          property: 'og:description',
          content:
            'Write Markdown. Stay in flow. Smart file tree, live GFM preview, integrated terminal, graph view, backlinks.',
        },
        { name: 'theme-color', content: '#1e1e1e' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/mdview.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap',
        },
      ],
    },
  },
})
