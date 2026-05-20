---
title: "mdview v1.4.0 — Feature Breakdown"
version: 1.4.0
created: 2026-05-19
status: planning
---

# v1.4.0 Feature Breakdown

Mười một tính năng + một bug fix. Quan trọng nhất: fix scroll sync (đang sai logic) và gọn lại header.

---

## 0. FIX: Scroll Sync sai giữa Editor và Preview

### 0.1 Phân tích gốc rễ

Scroll sync hiện tại dùng công thức **`scrollTop / (scrollHeight - clientHeight)`** — tỉ lệ vị trí thanh cuộn, không phải tỉ lệ vị trí nội dung.

**Tại sao header bị lệch:**

| Yếu tố | Editor (CodeMirror) | Preview (HTML) |
|--------|---------------------|----------------|
| `# Title` (h1) | 1 dòng ~20px | font-size 1.8em + margin 1.4em + border-bottom — ~80px |
| Tỉ lệ không gian | Đồng đều (monospace từng dòng) | Không đồng đều (heading to, code block rộng, paragraph thấp) |

Editor có 100 dòng source, h1 ở dòng 10 (~10% scrollbar). Preview render h1 đó chiếm 80px / 800px tổng = 10% scrollbar → có vẻ đúng. Nhưng các heading phía sau (h2, h3) bị "đẩy xuống" do các heading trước đó chiếm nhiều không gian hơn trong preview so với editor → sai lệch tích lũy.

**Ví dụ cụ thể:** Document có `# H1` ở dòng 5, `## H2` ở dòng 30, `### H3` ở dòng 60. Editor scroll đến H3 ở ~58%. Preview: H1 chiếm 80px, đoạn text 300px, H2 chiếm 60px, thêm text 200px, H3 bắt đầu ở ~640px / 800px = 80%. Lệch 22%.

### 0.2 Giải pháp: Sync theo vị trí heading thay vì scrollbar

**Cách tiếp cận:** Map scroll position dựa trên heading gần nhất thay vì phần trăm scrollbar.

1. **Trong PreviewPane:** Parse DOM tìm tất cả `h1`–`h6`, ghi nhận `{ id, offsetTop }` của từng heading
2. **Khi user scroll preview:** Tìm heading gần nhất phía trên viewport → emit `headingId` (hoặc index heading)
3. **SourceEditor nhận headingId:** Tìm dòng chứa heading đó trong source → set scroll position của CodeMirror để đưa dòng đó lên đầu viewport
4. **Ngược lại (editor → preview):** Khi editor scroll, parse source tìm heading gần nhất phía trên → emit headingId → preview scroll đến `offsetTop` của heading đó

**Fallback cho document không có heading:** Giữ nguyên scrollbar-percent cho document thuần text.

### 0.3 Stories

#### S-B1 — PreviewPane: trích xuất danh sách heading từ DOM

**Goal:** Sau mỗi lần render HTML, parse DOM lấy danh sách heading với `offsetTop`.

**Scope:**
- `PreviewPane.vue`: sau `watch(html, ...)`, query `root.value.querySelectorAll('h1,h2,h3,h4,h5,h6')`
- Lưu `headings: { id: string; offsetTop: number; level: number }[]` vào ref
- Gán `id` cho mỗi heading nếu chưa có (dùng `markdown-it-anchor` đã tự sinh id)
- Re-calculate khi `ResizeObserver` fire (Mermaid SVG thay đổi chiều cao)

**Complexity:** Thấp

---

#### S-B2 — PreviewPane: emit heading index khi user scroll

**Goal:** Thay vì emit scroll-percent, emit index của heading gần nhất phía trên viewport.

**Scope:**
- `onUserScroll()`: thay vì tính `scrollTop / max`, duyệt `headings[]` tìm heading cuối cùng có `offsetTop <= scrollTop + 50` (50px buffer cho heading sát mép trên)
- Emit `emit("scrollToHeading", headingIndex)` 
- Nếu không có heading nào (document thuần text): fallback emit `emit("scroll", percent)` như cũ
- `defineEmits` thêm event `scrollToHeading: [index: number]`

**Complexity:** Thấp

---

#### S-B3 — SourceEditor: tìm và scroll đến heading trong source

**Goal:** Nhận heading index, tìm dòng tương ứng trong markdown source, scroll CodeMirror đến đó.

**Scope:**
- Parse source text tìm heading pattern `/^#{1,6}\s+/m` — map `{ lineNumber, level }` 
- Nhận prop `scrollToHeading?: number` → tìm `sourceHeadings[scrollToHeading]` 
- Dùng `view.domAtPos(pos)` hoặc `view.lineBlockAt(line)` để lấy top position → set `view.scrollDOM.scrollTop`
- Guard loop: nếu editor đang programmatic scroll → không re-emit

**Complexity:** Trung bình — cần map đúng line → pixel position trong CodeMirror

---

#### S-B4 — SourceEditor: reverse map (editor scroll → heading index)

**Goal:** Khi user scroll editor, emit heading index thay vì scroll-percent.

**Scope:**
- Trong `scroll` event handler: parse source tìm heading gần nhất phía trên current `scrollTop`
- Dùng `view.lineBlockAtHeight(scrollTop)` lấy line number → tìm heading <= line đó
- Emit `emit("scrollToHeading", headingIndex)` hoặc fallback `emit("scroll", percent)`

**Complexity:** Thấp

---

#### S-B5 — PreviewPane: nhận heading index → scroll đến offsetTop

**Goal:** Nhận prop `scrollToHeading?: number` → scroll `.preview-pane` đến `headings[index].offsetTop`.

**Scope:**
- Watch `() => props.scrollToHeading` → `root.value.scrollTop = headings[index].offsetTop`
- Guard programmatic scroll (không re-emit)
- Fallback: nếu không có prop → dùng `scrollPercent` như cũ

**Complexity:** Thấp

---

#### S-B6 — EditorArea: re-wire two-way sync với heading index

**Goal:** Thay thế `scrollPercent`/`previewScrollPercent` bằng `headingIndex` hai chiều.

**Scope:**
- `EditorArea.vue`: thêm `headingIndex = ref(-1)`, `previewHeadingIndex = ref(-1)`
- Wire: editor `@scroll-to-heading` → `headingIndex` → PreviewPane prop `:scroll-to-heading`
- Wire ngược: PreviewPane `@scroll-to-heading` → `previewHeadingIndex` → SourceEditor prop `:scroll-to-heading`
- Guard loop với `scrollSource` pattern hiện có
- Giữ fallback `scrollPercent` cho document không heading

**Dependency:** S-B2, S-B3, S-B4, S-B5

**Complexity:** Trung bình

---

### 0.4 Implementation Order

```
S-B1 (parse headings) → S-B2 (emit heading index) → S-B5 (receive heading index)
                            ↘ S-B4 (editor emit heading) → S-B3 (editor receive heading)
                                                                      ↘ S-B6 (wire)
```

---

## 1. Nút Refresh File Explorer

### 1.1 Phân tích

File tree hiện tại **không có cơ chế auto-refresh** — không file watcher, không polling. Tree chỉ cập nhật khi app tự thay đổi (tạo/xóa/đổi tên file). File thêm từ bên ngoài (terminal, editor khác) không hiển thị.

`workspace.refreshRoot()` đã tồn tại nhưng:
- Chỉ refresh một level (root) — không recursively refresh subdirectory đã expand
- Blast away expand state — tất cả folder đang mở bị collapse

### 1.2 Stories

#### S1 — workspace: `refreshRootPreservingState(rootPath)`

**Goal:** Refresh toàn bộ tree cho một root, giữ lại trạng thái expand/collapse.

**Scope:**
- `workspace.ts`: thêm hàm `collectExpandedPaths(nodes: TreeNode[]): string[]` — walk đệ quy thu thập path của mọi node có `expanded === true`
- Thêm hàm `reExpandPaths(nodes: TreeNode[], expandedPaths: string[]): Promise<void>` — với mỗi path trong danh sách, tìm node tương ứng, gọi `listDir(path)`, set `expanded = true`, đệ quy vào children
- `refreshRootPreservingState(rootPathVal)`: reload root children, sau đó `reExpandPaths`
- Export `refreshRootPreservingState` trong return object

**Acceptance:**
- Sau refresh, các folder đang expand vẫn expand
- Subdirectory đã expand được reload với nội dung mới
- File mới/xuất hiện trong tree, file đã xóa biến mất

**Complexity:** Trung bình — đệ quy expand + reload

---

#### S2 — UI: nút refresh trên `.ws-root-header`

**Goal:** Thêm nút refresh (icon xoay) vào `.ws-root-actions`.

**Scope:**
- `ExplorerPanel.vue`: thêm button trong `.ws-root-actions`:
  ```html
  <button class="icon-btn ws-root-add" title="Refresh Explorer" @click="workspace.refreshRootPreservingState(root.path)">
      <Icon icon="lucide:refresh-cw" width="14" height="14" />
  </button>
  ```
- Icon `lucide:refresh-cw` — đã có sẵn trong Lucide collection
- Dùng class `ws-root-add` hiện có (hiện on hover, opacity transition)

**Dependency:** S1

**Complexity:** Rất thấp

---

## 2. Icon riêng cho AI Agent Files

### 2.1 Phân tích

Các file như `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`, `.github/copilot-instructions.md` có nội dung là hướng dẫn cho AI agent. Phân biệt bằng icon robot/bot thay vì icon markdown thông thường.

Pattern nhận diện:
- `CLAUDE.md`
- `AGENTS.md`
- `.cursorrules`
- `.cursor/rules/*.md`
- `.github/copilot-instructions.md`
- `*.cursorrules` (any file with extension)
- `rules/*.md` trong `.cursor/`

Danh sách mở rộng được.

### 2.2 Stories

#### S3 — FileTreeNode: hiển thị icon robot cho AI agent files

**Goal:** Trong `FileTreeNode.vue` và `ExplorerPanel.vue` tab context, hiển thị icon `lucide:bot` thay vì `lucide:file-text` cho các file AI agent.

**Scope:**
- Tạo helper `isAgentFile(filename: string): boolean` trong `workspace.ts` hoặc utils:
  ```ts
  const AGENT_FILES = [
    "CLAUDE.md", "AGENTS.md", ".cursorrules",
  ];
  const AGENT_PATTERNS = [
    /\.cursor\/rules\/.*\.md$/,
    /\.github\/copilot-instructions\.md$/,
  ];
  ```
- `FileTreeNode.vue`: trong phần render icon, check `isAgentFile(node.name)` → dùng `lucide:bot` màu `var(--accent)`
- `ExplorerPanel.vue`: context menu và hiển thị tab cũng cần check tương tự
- `TabBar.vue`: icon tab cho file agent → `lucide:bot` (optional, có thể để sau)

**Acceptance:**
- `CLAUDE.md`, `AGENTS.md` hiển thị icon robot trong tree
- Các file `.md` thông thường giữ nguyên icon `lucide:file-text`
- Icon robot có màu accent để nổi bật

**Complexity:** Thấp

---

## 3. Tích hợp TailwindCSS

### 3.1 Phân tích

Hiện tại toàn bộ style dùng CSS custom properties + global `<style>` blocks (~1,500 dòng CSS trên 17 files). Không có PostCSS config.

**TailwindCSS v4** dùng `@tailwindcss/vite` plugin — không cần PostCSS. Tương thích hoàn toàn với Vite 6 + Vue 3 + Tauri 2.

**Rủi ro chính:**
- Tailwind's preflight reset (`box-sizing: border-box`, `border-style: solid`, reset margin/padding) có thể conflict với CSS hiện tại
- `PreviewPane.vue` (262 dòng) style cho HTML render từ markdown — không nên port sang Tailwind
- CodeMirror và xterm có style riêng — không cần Tailwind

**Khuyến nghị: incremental adoption** — thêm Tailwind, dùng cho component mới trước, port dần component đơn giản. Không port PreviewPane, SourceEditor, TerminalView.

### 3.2 Stories

#### S-T1 — Cài đặt và cấu hình Tailwind

**Goal:** Thêm TailwindCSS v4 vào project, verify không vỡ layout.

**Scope:**
- `pnpm add tailwindcss @tailwindcss/vite`
- `vite.config.ts`: import và thêm `tailwindcss()` plugin
- `src/styles/main.css`: `@import "tailwindcss"` đầu file
- Check `pnpm typecheck && pnpm build` pass
- Chạy thử `pnpm tauri:dev` — kiểm tra layout không vỡ

**Nếu preflight gây vỡ:**
```css
@import "tailwindcss";
@layer base {
  *, ::before, ::after { box-sizing: content-box; }
}
```
Hoặc dùng `@tailwindcss/vite` với config tắt preflight.

**Complexity:** Thấp — chủ yếu verify

---

#### S-T2 — Map design tokens sang Tailwind theme

**Goal:** Định nghĩa `@theme` block để dùng CSS variables trong Tailwind utility classes.

**Scope:**
- `main.css`: thêm `@theme` block mapping `--bg-*`, `--text-*`, `--border`, `--accent`, `--danger` vào Tailwind theme
- Cho phép dùng class như `bg-[var(--bg-app)]` hoặc định nghĩa alias ngắn hơn
- Giữ nguyên toàn bộ CSS cũ — không xóa gì

**Complexity:** Thấp

---

#### S-T3 — Port component đơn giản đầu tiên

**Goal:** Port 1-2 component đơn giản sang Tailwind utilities để validate approach.

**Ứng viên:** `App.vue` (34 dòng CSS, layout đơn giản), `AppHeader.vue` (43 dòng, sắp bị xóa)

**Complexity:** Thấp

---

## 4. Dọn AppHeader — chuyển nút vào TabBar

### 4.1 Phân tích

AppHeader (32px) hiện chứa: title "mdview" (trang trí), theme toggle, settings, sidebar toggle. Trong đó:
- Sidebar toggle đã có bản sao trong `ExplorerPanel.vue` `.sidebar-activity-row`
- Title "mdview" không có chức năng

→ Có thể xóa toàn bộ AppHeader, tiết kiệm 32px dọc.

### 4.2 Stories

#### S4 — TabBar: thêm action buttons bên phải

**Goal:** Thêm theme toggle + settings button vào bên phải TabBar, pin cố định không scroll.

**Scope:**
- `TabBar.vue`:
  - Import `useUiStore`, `useThemeStore`
  - Thêm `<div class="tab-bar-actions">` chứa 2 button (theme, settings)
  - Style: `flex-shrink: 0` — không bị scroll cùng tab list
  ```css
  .tab-bar-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 4px;
    flex-shrink: 0;
  }
  ```

**Acceptance:**
- Theme và settings button hiển thị ở rìa phải TabBar
- Khi tab overflow scroll ngang, 2 button vẫn cố định bên phải
- Click hoạt động như trước

**Complexity:** Thấp

---

#### S5 — Xóa AppHeader khỏi layout

**Goal:** Xóa `AppHeader.vue` và remove khỏi `App.vue`.

**Scope:**
- `App.vue`: xóa `import AppHeader`, xóa `<AppHeader />` khỏi template
- Xóa `src/components/AppHeader.vue`
- Sidebar toggle trong ExplorerPanel `.sidebar-activity-row` vẫn hoạt động
- `Cmd/Ctrl+B` global shortcut trong `App.vue` vẫn hoạt động
- Verify layout: `.app-root` → `.app-shell` (full height, không còn header)

**Dependency:** S4 (cần TabBar có button trước khi xóa AppHeader)

**Complexity:** Rất thấp

---

### 4.3 Implementation Order

```
S4 (TabBar buttons) → S5 (xóa AppHeader)
```

---

## 5. TabBar scrollable (đã có, cần cải thiện)

### 5.1 Phân tích

TabBar **đã có scroll ngang** (`.tab-list { overflow-x: auto }`). Nhưng UX có thể cải thiện:
- Không có nút scroll left/right
- Scrollbar mặc định của OS (có thể xấu trên một số nền tảng)
- Không có indicator "còn tab bên phải"

### 5.2 Stories

#### S6 — Cải thiện UX scroll tab

**Goal:** Thêm nút chevron left/right khi tab list overflow.

**Scope:**
- `TabBar.vue`: thêm 2 nút `<` `>` ở hai đầu `.tab-list`, hiện khi overflow
- Dùng `ResizeObserver` hoặc check `scrollWidth > clientWidth` để quyết định hiển thị
- Click nút → scroll tab list 200px
- Style nút: `width: 24px`, icon `lucide:chevron-left` / `lucide:chevron-right`, size 14
- Tùy chọn: ẩn scrollbar (CSS `scrollbar-width: none` hoặc `::-webkit-scrollbar { display: none }`)

**Acceptance:**
- Khi tabs vừa đủ: không hiện nút
- Khi tabs overflow: hiện nút phải (và trái khi đã scroll)
- Click nút scroll mượt (có thể thêm `scroll-behavior: smooth`)

**Complexity:** Thấp

---

## 6. Toggle Word Wrap trong Editor

### 6.1 Phân tích

CodeMirror 6 hiện tại không bật `EditorView.lineWrapping` — dòng dài bị scroll ngang. Cần toggle để user chọn giữa scroll ngang (code-focused) hoặc wrap (reading-focused).

CM hỗ trợ thay đổi extension động qua compartment pattern (`EditorView.dispatch` với `reconfigure`). Hoặc đơn giản hơn: toggle state → destroy/recreate view (với tab hiện tại, view đã bị destroy khi đổi tab nên recreate rẻ).

### 6.2 Stories

#### S7 — SourceEditor: thêm toggle word wrap

**Goal:** Thêm nút toggle word-wrap trong editor toolbar.

**Scope:**
- `SourceEditor.vue`: thêm state `const wordWrap = ref(false)`
- Khi toggle: dùng `view.dispatch({ effects: reconfigureEffect })` hoặc destroy + rebuild view với `EditorView.lineWrapping()` trong extension array
- Thêm button trong toolbar (dòng 140-180 của template hiện tại):
  ```html
  <button class="icon-btn" title="Toggle Word Wrap" @click="toggleWrap()">
      <Icon icon="lucide:wrap-text" width="14" height="14" />
  </button>
  ```
- Highlight button khi wrap đang bật (class `active`)

**Acceptance:**
- Click toggle → dòng dài tự xuống dòng
- Click lần nữa → trở về scroll ngang
- Không mất nội dung khi toggle
- Trạng thái wrap giữ nguyên khi chuyển tab (session-scoped, không persist)

**Complexity:** Thấp

---

## 7. Drag-and-Drop Sắp Xếp Tab

### 7.1 Phân tích

TabBar hiện tại hiển thị tab cố định theo thứ tự mở. Cần hỗ trợ kéo thả để sắp xếp lại.

Native HTML drag API đủ dùng — không cần thư viện ngoài. Pattern: `draggable="true"` trên mỗi tab, `@dragstart` → set data, `@dragover.prevent` → cho phép drop, `@drop` → reorder.

### 7.2 Stories

#### S8 — Tabs store: `moveTab(fromIndex, toIndex)`

**Goal:** Thêm action `moveTab(fromIndex, toIndex)` vào `tabs` store.

**Scope:**
- `tabs.ts`: thêm function `moveTab(fromIndex: number, toIndex: number)`
  ```ts
  function moveTab(fromIndex: number, toIndex: number) {
    const [moved] = tabs.value.splice(fromIndex, 1);
    tabs.value.splice(toIndex, 0, moved);
  }
  ```
- Không cần persist thứ tự (session-scoped)
- Export trong return object

**Complexity:** Rất thấp

---

#### S9 — TabBar: HTML drag-and-drop

**Goal:** Kéo thả tab để đổi thứ tự trong TabBar.

**Scope:**
- `TabBar.vue`: mỗi `<div class="tab">` thêm:
  ```html
  draggable="true"
  @dragstart="onDragStart($event, index)"
  @dragover.prevent
  @drop="onDrop($event, index)"
  @dragenter.prevent
  ```
- `onDragStart`: set `event.dataTransfer.effectAllowed = 'move'`, lưu source index
- `onDrop`: gọi `tabs.moveTab(sourceIndex, targetIndex)`
- Thêm drag feedback: CSS `opacity: 0.4` khi đang drag, đường kẻ drop indicator giữa các tab

**CSS drop indicator:**
```css
.tab.drag-over-left::before,
.tab.drag-over-right::after {
  content: '';
  position: absolute;
  width: 2px;
  background: var(--accent);
}
```

**Dependency:** S8

**Acceptance:**
- Kéo tab từ vị trí A → thả vào vị trí B → tab đổi thứ tự
- Drop indicator hiển thị trực quan
- Tab đang drag có opacity giảm
- Không ảnh hưởng đến close button

**Complexity:** Thấp

---

## 8. Danh Sách Workspace/Folder Gần Đây

### 8.1 Phân tích

Khi mở app không có workspace (first launch hoặc sau khi `removeWorkspace()`), màn hình hiển thị nút "Add Folder" và "Open Workspace…". Có thể hiển thị danh sách workspace gần đây để mở nhanh.

### 8.2 Stories

#### S10 — Workspace store: recent workspaces

**Goal:** Lưu và hiển thị danh sách workspace gần đây.

**Scope:**
- `workspace.ts`: thêm `recentWorkspaces: ref<string[]>([])` (tối đa 10)
- Mỗi khi `openFolder()` hoặc `openWorkspaceFile()` thành công → thêm path vào đầu `recentWorkspaces`, dedup, trim xuống 10
- Persist trong store file (`KEY_RECENT_WORKSPACES`)
- Load trong `restoreWorkspace()`

**Complexity:** Thấp

---

#### S11 — ExplorerPanel: hiển thị recent workspaces

**Goal:** Khi không có workspace, hiển thị danh sách gần đây thay vì chỉ hai nút.

**Scope:**
- `ExplorerPanel.vue`: trong `.sidebar-empty` (khi `!workspace.hasWorkspace`), thêm section "Recent":
  ```html
  <div v-if="workspace.recentWorkspaces.length" class="recent-list">
    <div class="recent-header">Recent</div>
    <button
      v-for="(p, i) in workspace.recentWorkspaces"
      :key="i"
      class="recent-item"
      :title="p"
      @click="openRecent(p)"
    >
      <Icon icon="lucide:folder" width="14" height="14" />
      <span>{{ basename(p) }}</span>
      <span class="recent-path">{{ parentOf(p) }}</span>
    </button>
  </div>
  ```
- `openRecent(path)`: gọi `workspace.openFolder(path)` hoặc `openWorkspaceFile(path)` tùy extension
- Giữ nguyên hai nút "Add Folder" / "Open Workspace…" phía trên
- Style: compact, mỗi item hiển thị folder name + parent path (muted)

**Dependency:** S10

**Complexity:** Thấp

---

## 9. Table of Contents (TOC)

### 9.1 Phân tích

Document markdown dài cần điều hướng nhanh đến các section. TOC hiển thị danh sách heading, click → scroll đến vị trí tương ứng trong editor và preview.

Có thể reuse logic heading extraction từ S-B1 (scroll sync fix) — danh sách heading đã được parse sẵn.

### 9.2 Stories

#### S12 — TocPanel component

**Goal:** Panel TOC hiển thị trong sidebar hoặc overlay.

**Scope:**
- `src/components/TocPanel.vue`: component độc lập
- Props: `headings: { id, text, level }[]` (từ preview parse)
- Hiển thị danh sách heading với indent theo level (h1 = 0, h2 = 1 indent, …)
- Click heading → emit `@navigate(headingIndex)`
- Highlight heading hiện tại (active state dựa trên scroll position)
- Style: font-mono cho numbering, màu `var(--text-muted)` cho h3+ , `var(--text)` cho h1-h2
- Đặt trong `ExplorerPanel.vue` `.sidebar-body` như một view riêng (toggle giữa file tree và TOC)

**Vị trí UI:**
- Thêm tab switcher trong `.sidebar-activity-row`: "Explorer" | "Outline"
- Click "Outline" → hiện TocPanel thay vì file tree
- Click "Explorer" → hiện file tree
- State `activeSidebarView: 'explorer' | 'outline'` trong `ui` store

**Complexity:** Trung bình — cần sidebar view switching + scroll tracking

---

#### S13 — Wire TOC với editor và preview

**Goal:** Click heading trong TOC → scroll cả editor và preview đến vị trí heading.

**Scope:**
- `ExplorerPanel.vue`: khi TOC emit `@navigate(index)`, emit event lên `App.vue` hoặc trực tiếp gọi scroll method
- Dùng cùng cơ chế heading sync từ S-B3 (editor scroll to heading line) và S-B5 (preview scroll to heading offsetTop)
- Optional: `@vueuse/core` `useActiveElement` để track heading nào đang trong viewport

**Dependency:** S12, S-B3, S-B5 (heading sync logic)

**Complexity:** Thấp

---

## 10. Export PDF

### 10.1 Phân tích

Cách đơn giản nhất: dùng `window.print()` với CSS `@media print`. Nhược điểm: phụ thuộc vào browser print dialog, không tự động hoá hoàn toàn. Ưu điểm: không cần thư viện, hỗ trợ mọi nền tảng, giữ nguyên CSS đẹp.

### 10.2 Stories

#### S14 — PreviewPane: build standalone HTML với print stylesheet

**Goal:** Hàm `buildStandaloneHtml` đã có sẵn — mở rộng với CSS print.

**Scope:**
- `PreviewPane.vue`: trong `buildStandaloneHtml()`, thêm `<style media="print">` block:
  ```css
  @media print {
    body { font-size: 12pt; line-height: 1.5; color: #000; background: #fff; }
    .markdown-body { max-width: 100%; padding: 0; }
    pre { border: 1px solid #ccc; background: #f5f5f5; }
    /* ẩn UI elements không cần thiết */
  }
  ```
- Thêm nút "Export PDF" trong preview toolbar (cạnh nút "Open in Browser")
- Click → gọi `buildStandaloneHtml(title)` → viết temp HTML → mở bằng system browser → tự động trigger print

**Hoặc đơn giản hơn:**
- Thêm nút "Print" trong preview toolbar
- Gọi `window.print()` trực tiếp trên webview (không cần temp file)
- CSS print stylesheet trong app (không cần standalone HTML)

**Acceptance:**
- Click "Export PDF" → mở print dialog với preview nội dung
- PDF output có style đẹp (font, màu, code block)
- Không bao gồm UI chrome (toolbar, sidebar)

**Complexity:** Thấp — chủ yếu CSS print

---

## 11. Tổng hợp

### Dependency Graph

```
Scroll Fix:    S-B1 → S-B2 → S-B5
                    ↘ S-B4 → S-B3 → S-B6

Refresh:       S1 → S2

AI Icons:      S3 (độc lập)

Tailwind:      S-T1 → S-T2 → S-T3

Header Clean:  S4 → S5

Tab Scroll:    S6 (độc lập)

Word Wrap:     S7 (độc lập)

Tab Drag:      S8 → S9

Recent Ws:     S10 → S11

TOC:           S12 → S13 (depend on S-B3, S-B5 heading sync)

Export PDF:    S14 (độc lập)
```

### Complexity Summary

| Story | Feature | Complexity | Frontend-only? |
|-------|---------|------------|---------------|
| S-B1 | Parse heading DOM | Thấp | ✅ |
| S-B2 | Emit heading index | Thấp | ✅ |
| S-B3 | CM scroll to line | Trung bình | ✅ |
| S-B4 | Editor emit heading | Thấp | ✅ |
| S-B5 | Preview scroll to heading | Thấp | ✅ |
| S-B6 | Wire two-way heading sync | Trung bình | ✅ |
| S1 | refreshRootPreservingState | Trung bình | ✅ |
| S2 | Refresh button UI | Rất thấp | ✅ |
| S3 | AI agent file icon | Thấp | ✅ |
| S-T1 | Cài Tailwind + verify | Thấp | ✅ |
| S-T2 | Map tokens → theme | Thấp | ✅ |
| S-T3 | Port 1 component | Thấp | ✅ |
| S4 | TabBar buttons | Thấp | ✅ |
| S5 | Xóa AppHeader | Rất thấp | ✅ |
| S6 | Tab scroll chevron UX | Thấp | ✅ |
| S7 | Toggle word wrap | Thấp | ✅ |
| S8 | Store moveTab | Rất thấp | ✅ |
| S9 | Tab drag-and-drop UI | Thấp | ✅ |
| S10 | Recent workspaces store | Thấp | ✅ |
| S11 | Recent workspaces UI | Thấp | ✅ |
| S12 | TocPanel component | Trung bình | ✅ |
| S13 | Wire TOC with sync | Thấp | ✅ |
| S14 | Export PDF (print stylesheet) | Thấp | ✅ |

**Toàn bộ v1.4.0 là frontend-only** — không cần Rust command mới. Package mới: `tailwindcss`, `@tailwindcss/vite`.

### New Files (Expected)

```
src/components/TocPanel.vue            (S12) — TOC panel
```

### Modified Files (Expected)

```
src/components/PreviewPane.vue        (S-B1, S-B2, S-B5) — heading sync
src/components/SourceEditor.vue       (S-B3, S-B4, S7) — heading sync + word wrap
src/components/EditorArea.vue         (S-B6) — re-wire sync
src/stores/workspace.ts              (S1, S10) — refreshRootPreservingState + recent workspaces
src/stores/tabs.ts                   (S8) — moveTab
src/stores/ui.ts                     (S12) — activeSidebarView state
src/components/ExplorerPanel.vue     (S2, S11) — refresh button + recent list + view switcher
src/components/FileTreeNode.vue      (S3) — AI agent icon
src/components/TabBar.vue            (S4, S6, S9) — action buttons + scroll UX + drag-drop
src/App.vue                          (S5) — remove AppHeader
vite.config.ts                       (S-T1) — tailwindcss plugin
src/styles/main.css                  (S-T2) — @import tailwind + theme tokens
```

### Deleted Files (Expected)

```
src/components/AppHeader.vue         (S5)
```
