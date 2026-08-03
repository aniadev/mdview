/**
 * Dynamic sitemap — keeps <lastmod> accurate without a manual edit.
 * Prerendered to a static file at build time (see nitro.prerender.routes).
 */
export default defineEventHandler((event) => {
  const siteUrl = useRuntimeConfig().public.siteUrl as string
  const lastmod = new Date().toISOString().split('T')[0]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>${siteUrl}/og-image.png</image:loc>
      <image:title>mdview — focused Markdown workspace editor</image:title>
    </image:image>
  </url>
</urlset>
`

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return xml
})
