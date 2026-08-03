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
  plugins/reveal.ts            # v-reveal directive (SSR-safe, có getSSRProps)
  assets/css/main.css          # design tokens + base
public/mdview.png              # favicon (copy từ app)
```

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

Animation: `v-reveal` scroll-reveal (IntersectionObserver, có stagger qua `v-reveal="100"`), caret blink trong window mock, dashed-edge animation ở graph, hover lift trên cards.

## Mockup nguồn

Giao diện được chốt từ `sketches/001-dark-terminal/` (variant A — Dark Terminal). Hai variant khác (`002-light-editorial`, `003-neon-dev`) vẫn giữ trong `sketches/` để so sánh.

## Pitfalls đã gặp (đáng nhớ)

- **Directive + SSR**: directive custom trong template Nuxt phải đăng ký ở cả server (plugin không suffix `.client`) và phải có `getSSRProps()`, nếu không server-renderer crash `Cannot read properties of undefined (reading 'getSSRProps')`.
- **Version matrix Nuxt 4.5**: vue-tsc 3.3.9 cần TS 5.9+ và vue-router **5.2.0** (4.6.x/4.5.x đã bỏ subpath `volar/sfc-route-blocks` mà @vue/language-core cần). Nuxt 4.5.1 generate tsconfig dùng option `libReplacement` (TS 5.9+).
- **Workspace pnpm**: repo root có `pnpm-workspace.yaml` — landing phải có `pnpm-workspace.yaml` riêng (`packages: [.]`) để thành workspace độc lập, không bị nuốt vào workspace của app.
- **v-html + scoped style**: nội dung `v-html` không nhận scoped CSS — các class trong window mock phải nằm ở style block không scoped (prefix `aw-`, `g-`).
- Reinstall deps xong phải restart dev server (module graph cũ bị stale → 500 `reading 'value'`).
