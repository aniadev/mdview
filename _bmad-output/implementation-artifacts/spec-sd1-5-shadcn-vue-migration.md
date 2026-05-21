---
title: 'shadcn/vue Migration — SD1–5: Infrastructure, Button, ContextMenu, Dialog, Input/Tooltip'
type: 'refactor'
created: '2026-05-22'
status: 'done'
baseline_commit: 'fb37f2d4dbe8b3dfecba5dd7e00adb777f5b2fae'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** mdview dùng hand-rolled CSS components (`.ctx-menu` Teleport, custom modal overlay, raw `<button>`) không có accessibility built-in (keyboard nav, focus trap, ARIA) — khó maintain và scale thêm UI.

**Approach:** Cài `radix-vue` + `@vueuse/core`; thêm path alias `@`; tạo thin wrapper components trong `src/components/ui/` sử dụng Radix primitives cho behavior/a11y và mdview Tailwind tokens cho styling; migrate lần lượt Button → ContextMenu → Dialog → Input/Tooltip.

## Boundaries & Constraints

**Always:**
- Wrapper components đặt trong `src/components/ui/` — dùng `cn()` từ `@/utils/cn`
- Component wrappers dùng mdview Tailwind class names (`bg-sidebar`, `text-text`, `hover:bg-hover`, `border-border`, v.v.) — **không** map sang shadcn token names (`bg-background`, `bg-accent`)
- S-SD3 `ContextMenu`: một wrapper cho toàn bộ tree, dùng event delegation — `fsui.ctxMenu` state vẫn là single source of truth; riêng root-header dùng per-root `<ContextMenu>` close-over `root.path`
- S-SD4 `Dialog`: giữ nguyên `ui.settingsOpen` / `updater.modalOpen` store — chỉ thay wrapper HTML; Radix Dialog handles focus trap + Esc + portal
- S-SD5 `Input` wrap chỉ khi không thay đổi `InlineFilenameInput` emit/prop API; Tooltip đặt `delay-duration: 400`

**Ask First:**
- N/A

**Never:**
- Không chạy `npx shadcn-vue@latest init` — sẽ overwrite `tailwind.css` và `vite.config.ts`
- Không rename/remove mdview CSS vars (`--bg-app`, `--accent`, `--text`, v.v.)
- Không thêm `lucide-vue-next` — project dùng `@iconify/vue`
- Không thêm tooltip vào toolbar buttons (ngoài scope S-SD5)

</frozen-after-approval>

## Code Map

- `package.json` — thêm `radix-vue`, `@vueuse/core`
- `vite.config.ts:1-41` — không có `resolve.alias`; cần thêm `@` → `./src`
- `tsconfig.json` — không có `paths`; sync với vite alias
- `src/styles/_variables.scss:1-38` — mdview CSS vars; thêm `--radius: 4px`
- `src/utils/cn.ts` — tồn tại (`clsx` + `tailwind-merge`); không đổi
- `src/components/ui/Button.vue:1-60` — CVA pattern đúng; chỉ fix import `cn` path
- `src/components/ExplorerPanel.vue:32-195,402,481-513` — `rootCtxMenu` ref, tree render, hai Teleport ctx-menu blocks
- `src/components/FileTreeNode.vue:65-68,124` — `onContextMenu` calls `fsui.openContextMenu()`
- `src/stores/fsui.ts` — `ctxMenu` state (x, y, visible, isDir, isMdFile, targetPath)
- `src/components/SettingsModal.vue:112-246` — Teleport overlay `ui.settingsOpen`
- `src/components/UpdateModal.vue:34-99` — Teleport overlay `updater.modalOpen`
- `src/components/InlineFilenameInput.vue` — raw `<input>` standalone component

## Tasks & Acceptance

**Execution:**

- [x] `package.json` — `pnpm add radix-vue @vueuse/core` (S-SD1)

- [x] `vite.config.ts` — thêm `import path from 'node:path'` và `resolve: { alias: { '@': path.resolve(__dirname, './src') } }` vào `defineConfig` (S-SD1)

- [x] `tsconfig.json` — thêm `"baseUrl": "."` và `"paths": { "@/*": ["./src/*"] }` vào `compilerOptions` (S-SD1)

- [x] `components.json` — tạo file tại project root: `{ "style": "default", "tailwind": { "css": "src/styles/tailwind.css", "baseColor": "slate", "cssVariables": true }, "aliases": { "components": "@/components", "utils": "@/utils" } }` (S-SD1)

- [x] `src/styles/_variables.scss` — thêm `--radius: 4px` vào block `:root,[data-theme='dark']` và `[data-theme='light']` (S-SD1)

- [x] `src/components/ui/Button.vue` — đổi `from "../../utils/cn"` → `from "@/utils/cn"` (S-SD2)

- [x] `src/components/ui/ContextMenu.vue` — tạo file: re-export Radix-vue `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuGroup`, `ContextMenuItem`, `ContextMenuSeparator`, `ContextMenuLabel` dưới dạng styled wrappers. `ContextMenuContent`: `cn("z-50 min-w-[140px] rounded-[var(--radius)] border border-border bg-sidebar p-1 shadow-md text-text text-[13px]")`. `ContextMenuItem`: `cn("flex cursor-pointer items-center rounded-sm px-2 py-1.5 outline-none hover:bg-hover focus:bg-hover")`. `ContextMenuSeparator`: `cn("my-1 h-px bg-border")` (S-SD3)

- [x] `src/components/ExplorerPanel.vue` — **S-SD3**:
  - Import `ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator` từ `@/components/ui/ContextMenu.vue`
  - Xóa cả 2 Teleport blocks (`.ctx-menu` file/folder + root header) và `rootCtxMenu` ref
  - Wrap toàn bộ scrollable tree div với `<ContextMenu><ContextMenuTrigger as-child>…tree div…</ContextMenuTrigger><ContextMenuContent>…items từ fsui.ctxMenu…</ContextMenuContent></ContextMenu>`
  - Cho root header right-click: wrap từng `.ws-root-header` với per-root `<ContextMenu>` — `<ContextMenuContent>` có 1 item "Remove from Workspace" gọi `removeRootFromWs(root.path)` trực tiếp
  - Xóa CSS scoped `.ctx-menu`, `.ctx-item`, `.ctx-separator`

- [x] `src/components/ui/Dialog.vue` — tạo file: re-export Radix-vue `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`. `DialogOverlay`: `cn("fixed inset-0 z-[170] bg-black/45")`. `DialogContent`: `cn("fixed left-1/2 top-[15%] z-[180] -translate-x-1/2 rounded-[var(--radius)] border border-border bg-sidebar shadow-xl flex flex-col")` (S-SD4)

- [x] `src/components/SettingsModal.vue` — xóa Teleport + overlay div + `.settings-modal` wrapper; thay bằng `<Dialog :open="ui.settingsOpen" @update:open="v => !v && ui.closeSettings()"><DialogContent>…nội dung hiện tại…</DialogContent></Dialog>` (S-SD4)

- [x] `src/components/UpdateModal.vue` — tương tự: xóa Teleport + overlay; `<Dialog :open="updater.modalOpen" @update:open="v => { if (!v && updater.status !== 'downloading') updater.modalOpen = false }"><DialogContent>…</DialogContent></Dialog>` (S-SD4)

- [x] `src/components/ui/Input.vue` — tạo file: `<input>` với class `cn("flex h-8 w-full rounded-[var(--radius)] border border-border bg-transparent px-2 py-1 text-[13px] text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50", class)` — props: `class?: string` + `v-bind="$attrs"` (S-SD5)

- [x] `src/components/InlineFilenameInput.vue` — thay raw `<input>` bằng `<Input>` từ `@/components/ui/Input.vue`; giữ nguyên toàn bộ props/emits/focus/keydown logic (S-SD5)

- [x] `src/components/ui/Tooltip.vue` — tạo file: re-export Radix-vue `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`. `TooltipContent`: `cn("z-50 rounded-[var(--radius)] bg-sidebar border border-border px-2 py-1 text-[11px] text-text shadow-md")` với default `side="bottom"`, `delay-duration: 400` (S-SD5)

**Acceptance Criteria:**
- `pnpm typecheck` pass 0 errors mới sau toàn bộ changes
- Right-click file/folder trong tree → ContextMenu mở đúng vị trí; keyboard ↑↓Enter Esc hoạt động; tất cả items hiện/ẩn đúng theo `isDir`/`isMdFile`
- Right-click workspace root header → "Remove from Workspace" item xuất hiện
- SettingsModal mở bằng ⚙ button; Esc đóng; click backdrop đóng; focus trap hoạt động (Tab không escape ra ngoài modal)
- UpdateModal Esc **không** đóng khi `updater.status === 'downloading'`
- InlineFilenameInput: autofocus, Enter commit, Esc cancel — behavior giữ nguyên
- Dark + light theme đồng nhất cho tất cả component mới

## Verification

**Commands:**
- `pnpm typecheck` — expected: 0 errors

## Design Notes

**ContextMenu event flow:** FileTreeNode vẫn gọi `fsui.openContextMenu(e, {...})` qua `@contextmenu` handler. Radix ContextMenuTrigger nhận cùng event, gọi `preventDefault()` nội bộ, mở Content tại cursor. Không cần `.prevent` modifier trên FileTreeNode handler nữa — xóa để tránh double-preventDefault.

**UpdateModal close guard:** `updater.modalOpen` là computed hay ref — check trước khi write. Nếu là action `updater.closeModal()` thì gọi đó thay vì trực tiếp set flag.

**Dialog z-index:** `DialogOverlay` z-170, `DialogContent` z-180 — giữ thấp hơn CM6 autocomplete popup (z-200).

## Suggested Review Order

**ContextMenu migration — điểm kiến trúc chính**

- Outer ContextMenuRoot wraps toàn bộ tree; `@update:open` cleans fsui state; `v-if` prevents stale menu on empty space right-click
  [`ExplorerPanel.vue:389`](../../src/components/ExplorerPanel.vue#L389)

- Inner per-root ContextMenuRoot chỉ cover ws-root-header; `@contextmenu.stop` blocks event bubble to outer root
  [`ExplorerPanel.vue:393`](../../src/components/ExplorerPanel.vue#L393)

- Outer CtxMenuContent guards `fsui.ctxMenu.visible` — prevents stale menu when right-clicking empty tree area
  [`ExplorerPanel.vue:477`](../../src/components/ExplorerPanel.vue#L477)

- FileTreeNode removes `e.stopPropagation()` — event must bubble to outer ContextMenuRoot trigger
  [`FileTreeNode.vue:65`](../../src/components/FileTreeNode.vue#L65)

- Styled ContextMenuContent wrapper: Portal + Radix Content + mdview tokens
  [`ui/ContextMenu.vue:1`](../../src/components/ui/ContextMenu.vue#L1)

- Styled ContextMenuItem with data-[disabled] states
  [`ui/ContextMenuItem.vue:1`](../../src/components/ui/ContextMenuItem.vue#L1)

**Dialog migration**

- AppDialog wrapper: DialogRoot + Portal + Overlay + Content trong một component; `@update:open` forwarded
  [`ui/Dialog.vue:1`](../../src/components/ui/Dialog.vue#L1)

- SettingsModal: `@update:open` gọi `onClose()` khi đóng; Radix handles focus trap + Esc internally
  [`SettingsModal.vue:113`](../../src/components/SettingsModal.vue#L113)

- UpdateModal close guard — prevents Esc/backdrop close khi state là downloading hoặc ready
  [`UpdateModal.vue:35`](../../src/components/UpdateModal.vue#L35)

**Input primitive + InlineFilenameInput**

- Input.vue `defineExpose` — wraps native input; exposes focus/select/setSelectionRange cho component ref callers
  [`ui/Input.vue:11`](../../src/components/ui/Input.vue#L11)

- InlineFilenameInput dùng `InstanceType<typeof UiInput>` ref type; gọi focus/setSelectionRange qua exposed API
  [`InlineFilenameInput.vue:15`](../../src/components/InlineFilenameInput.vue#L15)

**Infrastructure**

- `@` path alias — vite.config.ts resolve + tsconfig.json paths phải đồng bộ
  [`vite.config.ts:12`](../../vite.config.ts#L12)

- `--radius: 4px` CSS var định nghĩa trong cả dark và light theme blocks
  [`_variables.scss:18`](../../src/styles/_variables.scss#L18)
