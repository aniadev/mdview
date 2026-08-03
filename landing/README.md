# mdview — Landing Page

Landing page cho **mdview** (desktop app: focused Markdown workspace editor). Nuxt 4 (SSR), standalone workspace — không đụng vào lockfile của app chính ở repo root.

## Chạy

```sh
pnpm install
pnpm dev          # dev server (mặc định :3000)
pnpm build        # production build → .output/
pnpm preview      # serve bản build
pnpm typecheck    # vue-tsc qua nuxt typecheck
```

> Port 3000 có thể bị chiếm — Nuxt tự tìm port thay thế (thấy trong log: `Local: http://localhost:3002/`).

## Cấu trúc

```
app/
  app.vue                      # layout shell (NavBar + page + Footer)
  pages/index.vue              # hero + lắp ráp các section
  components/
    NavBar.vue                 # sticky nav + CTA
    AppWindow.vue              # hero mock: window editor 3 tab (clickable)
    FeatureGrid.vue            # 9 feature cards
    AiStrip.vue                # CLAUDE.md / AGENTS.md / .cursorrules strip
    GraphSection.vue           # v1.8 graph view (SVG static mock, SSR-safe)
    ShortcutsSection.vue       # bảng phím tắt
    DownloadSection.vue        # 3 OS cards
    SiteFooter.vue
  plugins/
    reveal.ts                  # v-reveal directive (SSR-safe, variants + delay)
    spotlight.ts               # v-spotlight directive (cursor-tracking glow)
    icons.ts                   # addCollection(lucide) offline
  assets/css/main.css          # design tokens + base
public/mdview-logo.png         # brand logo (resize từ root public/mdview.png)
```

## Deploy

Production: **https://mdviewz.vercel.app** (Vercel project `mdviewz`).

```sh
pnpm build
npx vercel deploy --prebuilt --prod --yes
# Vercel re-aliases to the auto-generated URL, so re-point the domain:
npx vercel alias set <deployment-url> mdviewz.vercel.app
```

> `mdview.vercel.app` đã bị một project không liên quan chiếm, nên dùng `mdviewz`.
> Nếu đổi domain: sửa `SITE_URL` trong `nuxt.config.ts` + `Sitemap:` trong `public/robots.txt`.

## Google Search Console

SEO đã cấu hình sẵn (meta robots/googlebot, canonical, hreflang, OG/Twitter,
JSON-LD, robots.txt, sitemap.xml). Chỉ còn **xác minh quyền sở hữu** — bước này
cần tài khoản Google của bạn:

1. Vào https://search.google.com/search-console → **Add property** → **URL prefix**
   → nhập `https://mdviewz.vercel.app`
2. Chọn phương thức **HTML tag**, copy phần `content="..."` (chỉ chuỗi token)
3. Thêm token theo một trong hai cách:
   - **Env var (khuyến nghị)** — trên Vercel: Settings → Environment Variables →
     `NUXT_PUBLIC_GOOGLE_SITE_VERIFICATION` = `<token>`, rồi deploy lại
   - **Hard-code** — sửa `GOOGLE_SITE_VERIFICATION` trong `nuxt.config.ts`
4. Deploy lại, bấm **Verify** trong Search Console
5. Sau khi verify: **Sitemaps** → submit `sitemap.xml`; dùng **URL Inspection** →
   *Request indexing* để Google crawl ngay thay vì chờ

Nếu để token rỗng, tag bị bỏ qua — site vẫn được index bình thường qua
robots.txt + sitemap.xml, chỉ là không xem được dữ liệu trong Search Console.

Kiểm tra structured data: https://search.google.com/test/rich-results

## Design system

Tokens trong `app/assets/css/main.css` — lấy trực tiếp từ tokens thật của app (`src/styles/_variables.scss`):

| Token | Giá trị | Nguồn |
|---|---|---|
| `--bg` | `#1e1e1e` | app dark bg |
| `--bg-code` | `#0d1117` | GitHub dark (app) |
| `--accent` | `#0078d4` | VSCode blue (app) |
| `--accent-hi` | `#4daafc` | app link |
| Font UI | Inter | app: system sans |
| Font mono | JetBrains Mono | app: SF Mono/Menlo |

Icons: **Iconify lucide** (giống app — `@iconify/vue` + `@iconify-json/lucide`, register offline qua `app/plugins/icons.ts` `addCollection()`, không CDN). Brand logo: ảnh app thật (`public/mdview.png` ở root repo, resize 128px → `landing/public/mdview-logo.png`).

Animation (đo bằng browser: 10 animation đang chạy, trước đó chỉ 2):

| Hiệu ứng | Nơi dùng |
|---|---|
| Hero entrance stagger | badge → h1 → sub → CTA → trust row (delay 50–520ms) |
| Typing effect | headline luân phiên 3 câu, caret glow |
| Gradient shimmer | chữ gradient trong h1 |
| Ambient orbs drift | `AmbientBg.vue` — 3 quả cầu blur 110px, 22–30s |
| Scroll progress | `ScrollProgress.vue` — thanh gradient trên cùng |
| Nav shrink | 66px → 56px + blur/shadow khi scroll > 24px |
| Cursor spotlight | `v-spotlight` trên 12 cards (feature + OS) |
| Graph draw-in | edges vẽ theo `stroke-dashoffset`, nodes pop sau, halo pulse ở node core |
| Button shine | vệt sáng quét ngang khi hover |
| Reveal variants | up / scale / left / right + blur-in, stagger theo index |

Tokens motion: `--ease-out` (0.16,1,0.3,1), `--ease-spring` (0.34,1.56,0.64,1). Có `@media (prefers-reduced-motion: reduce)` tắt toàn bộ.

## Mockup nguồn

Giao diện được chốt từ `sketches/001-dark-terminal/` (variant A — Dark Terminal). Hai variant khác (`002-light-editorial`, `003-neon-dev`) vẫn giữ trong `sketches/` để so sánh.

## Pitfalls đã gặp (đáng nhớ)

- **Directive + SSR**: directive custom trong template Nuxt phải đăng ký ở cả server (plugin không suffix `.client`) và phải có `getSSRProps()`, nếu không server-renderer crash `Cannot read properties of undefined (reading 'getSSRProps')`.
- **Version matrix Nuxt 4.5**: vue-tsc 3.3.9 cần TS 5.9+ và vue-router **5.2.0** (4.6.x/4.5.x đã bỏ subpath `volar/sfc-route-blocks` mà @vue/language-core cần). Nuxt 4.5.1 generate tsconfig dùng option `libReplacement` (TS 5.9+).
- **Workspace pnpm**: repo root có `pnpm-workspace.yaml` — landing phải có `pnpm-workspace.yaml` riêng (`packages: [.]`) để thành workspace độc lập, không bị nuốt vào workspace của app.
- **v-html + scoped style**: nội dung `v-html` không nhận scoped CSS — các class trong window mock phải nằm ở style block không scoped (prefix `aw-`, `g-`).
- Reinstall deps xong phải restart dev server (module graph cũ bị stale → 500 `reading 'value'`).
