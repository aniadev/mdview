---
title: "mdview v1.7.0 — Feature Breakdown"
version: 1.7.0
created: 2026-05-21
status: planning
---

# v1.7.0 Feature Breakdown

Phiên bản tập trung vào **trải nghiệm thị giác nhất quán** (shadcn design system), **UX workspace nâng cao** (Open Terminal from file), **sửa lỗi cốt lõi** (preview markdown, UX tạo file) và **tích hợp tính năng lấy cảm hứng từ Obsidian** — đồng thời thực hiện nghiên cứu khả thi cho Graph View phụ thuộc tài liệu.

---

## 0. BUG FIX: Preview markdown hiển thị sai Checkboxes, List và Newline

### 0.1 Phân tích gốc rễ

Kiểm tra `PreviewPane.vue` cho thấy `MarkdownIt` được khởi tạo với `breaks: false` — đây là nguyên nhân trực tiếp khiến các dòng đơn (soft newline) không được render thành `<br>`.

Thêm vào đó, CSS của `.markdown-body` thiếu styling rõ ràng cho `input[type="checkbox"]` nằm trong task list (`- [ ] item`). Bản thân `MarkdownIt` mặc định **không** kích hoạt plugin `markdown-it-task-lists` — checkbox chỉ render được nhờ đoạn regex post-process trong `render()` nhưng thiếu CSS tương ứng để căn chỉnh và hiển thị đúng trong list item context.

Đối với danh sách (ordered/unordered), CSS hiện tại của `.markdown-body ul, .markdown-body ol` có `margin: 0 0 1em 0` nhưng **thiếu** reset cho nested list và list-style-type, có thể bị ghi đè bởi CSS global của Tailwind preflight/reset.

**Root causes tóm lại:**
- `breaks: false` → soft newline bị nuốt
- Không có CSS hiển thị checkbox trong task list item (checkmark, spacing, cursor)
- Tailwind preflight có thể reset `list-style: none` gây danh sách không có bullet/number

### 0.2 Giải pháp & Bản thiết kế

1. Bật `breaks: true` trong MarkdownIt config (hoặc sử dụng plugin `markdown-it-br`).
2. Thêm CSS rõ ràng cho task list: `li:has(> input[type="checkbox"])` — căn chỉnh flex, cursor pointer.
3. Xác nhận và bổ sung `list-style-type` cho `ul` (disc) và `ol` (decimal) không bị reset.
4. Thêm `line-height` và `margin` cho `li` trong context list thông thường.

### 0.3 Stories

#### S-BF1 — PreviewPane: Sửa Newline rendering
* **Goal:** Đảm bảo soft-break (single newline) được render thành `<br>` trong preview.
* **Scope:**
  - Đổi `breaks: false` → `breaks: true` trong MarkdownIt constructor tại `PreviewPane.vue`.
  - Test với tài liệu có nội dung đoạn văn nhiều dòng ngắt đơn.
* **Complexity:** Thấp

#### S-BF2 — PreviewPane: Sửa Checkbox & List CSS
* **Goal:** Render đúng checkbox task-list và danh sách có bullet/number trong preview.
* **Scope:**
  - Thêm CSS `li:has(> input[type="checkbox"])` trong `<style>` của `PreviewPane.vue`: `display: flex; align-items: flex-start; gap: 6px;`
  - Thêm `input[type="checkbox"]` styling trong `.markdown-body`: `margin-top: 3px; flex-shrink: 0; cursor: pointer;`
  - Xác nhận `ul { list-style-type: disc }`, `ol { list-style-type: decimal }` không bị Tailwind preflight override — thêm explicit rule nếu cần.
  - Kiểm tra `li + li` spacing.
* **Complexity:** Thấp

---

## 1. BUG FIX: Tạo file mới trong folder chưa mở không hiển thị placeholder

### 1.1 Phân tích gốc rễ

Khi người dùng bấm **New File** trên một folder node trong tree, `ExplorerPanel` gọi `fsui.requestCreateIn(path)` — đặt `pendingCreateInDir` thành đường dẫn thư mục đó. Tuy nhiên, `FileTreeNode.vue` chỉ render `InlineFilenameInput` (placeholder) khi:

```
node.is_dir && node.expanded && fsui.pendingCreateInDir === node.path
```

Nếu `node.expanded === false` (folder chưa mở), điều kiện trên luôn `false` → `InlineFilenameInput` không được render → người dùng không thấy gì. Đây là **UX gap**: folder phải được tự động mở trước khi hiện input.

Điều tương tự xảy ra với `showCreateDirChild` cho tạo folder con.

### 1.2 Giải pháp & Bản thiết kế

Giải pháp đơn giản nhất: **auto-expand folder trước khi đặt pending state**. Trong `ctxNewFile()` và `startRootCreate()` tại `ExplorerPanel.vue`, kiểm tra nếu folder chưa expand thì gọi `workspace.toggleDir()` trước khi `fsui.requestCreateIn()`.

Cách tiếp cận thay thế sạch hơn: thêm method `workspace.ensureDirExpanded(path)` để expand một node theo path mà không toggle (không collapse nếu đã mở).

### 1.3 Stories

#### S-BF3 — ExplorerPanel & workspace store: Auto-expand folder khi tạo file/folder con
* **Goal:** Người dùng luôn thấy inline input ngay sau khi chọn "New File" hoặc "New Folder" dù folder chưa mở.
* **Scope:**
  - Thêm `workspace.ensureDirExpanded(path: string)` vào `workspace` store — expand node tương ứng nếu chưa expanded (không collapse).
  - Gọi `ensureDirExpanded` trước `fsui.requestCreateIn` tại `ctxNewFile()`, `ctxNewFolder()`, `startRootCreate()`, `startRootCreateDir()` trong `ExplorerPanel.vue`.
  - Tương tự trong `FileTreeNode.vue` tại `onCreateCommit` (đã có `toggleDir` nhưng chỉ áp dụng sau submit, không phải trước khi show input).
* **Complexity:** Thấp

---

## 2. TECHNICAL: Chuyển đổi Design System sang shadcn/vue

### 2.1 Phân tích gốc rễ

Hiện tại mdview đang dùng hệ thống CSS thuần (`main.scss` + scoped styles trong từng SFC) với CSS variables tự định nghĩa. Đã có một số component UI trong `src/components/ui/` (Button.vue), nhưng chưa có design system nhất quán cho toàn bộ ứng dụng.

**Vấn đề:**
- Component styles không đồng nhất giữa các SFC
- Không có primitive components chuẩn (Dialog, DropdownMenu, Tooltip, Input, Select...)
- Khó maintain visual consistency khi thêm tính năng mới
- Thiếu accessibility built-in (ARIA, keyboard navigation) cho các interactive elements

**Lý do chọn shadcn/vue:**
- shadcn/vue = bộ recipe dựa trên Radix-vue + Tailwind, copy trực tiếp vào codebase, không phụ thuộc thư viện nặng
- Dễ customize vì source code nằm trong project
- Có sẵn các primitive đã kiểm thử accessibility
- Phù hợp với stack Vue 3 + Tailwind v4 hiện tại

### 2.2 Giải pháp & Bản thiết kế

**Giai đoạn A — Setup shadcn/vue:**
- Cài `shadcn-vue` CLI, init với Tailwind v4 mode
- Tạo `src/components/ui/` làm home cho toàn bộ shadcn components
- Map CSS variables của shadcn (`--background`, `--foreground`, `--primary`, `--muted`...) vào biến theme hiện tại của mdview (`--bg-app`, `--text`, `--accent`...)

**Giai đoạn B — Component migration (theo độ ưu tiên):**
1. `Button` → thay thế Button.vue hiện tại
2. `DropdownMenu` → context menu hiện tại (`.ctx-menu`)
3. `Dialog` → SettingsModal, UpdateModal
4. `Tooltip` → các icon button trong toolbar
5. `Input` → InlineFilenameInput, SearchPanel search bar

**Giai đoạn C — Theme sync:**
- shadcn dùng CSS variables theo convention riêng — cần viết bridge layer trong `_variables.scss` để re-export variables mdview theme dưới tên shadcn convention.

### 2.3 Stories

#### S-SD1 — Infrastructure: Cài đặt và cấu hình shadcn/vue
* **Goal:** Khởi tạo shadcn/vue trong project, đồng bộ hệ màu.
* **Scope:**
  - Chạy `npx shadcn-vue@latest init` với Tailwind v4 mode.
  - Cấu hình `components.json` trỏ đúng alias `@/components/ui`.
  - Viết theme bridge trong `src/styles/_variables.scss`: map `--background → --bg-app`, `--foreground → --text`, `--primary → --accent`, `--muted → --bg-hover`, `--border → --border`, `--destructive → --danger`.
  - Verify build không bị break.
* **Complexity:** Trung bình

#### S-SD2 — Migration: Button component
* **Goal:** Thay thế `Button.vue` hiện tại bằng shadcn Button, giữ nguyên variants (default, ghost, outline, icon).
* **Scope:**
  - Add shadcn Button: `npx shadcn-vue@latest add button`.
  - Điều chỉnh variants và kích thước phù hợp với design hiện tại.
  - Thay thế tất cả import `./ui/Button.vue` trong `ExplorerPanel.vue`, `TabBar.vue`.
* **Complexity:** Thấp

#### S-SD3 — Migration: DropdownMenu / Context Menu
* **Goal:** Chuyển `.ctx-menu` CSS thuần thành shadcn DropdownMenu — có keyboard navigation, focus trap.
* **Scope:**
  - Add shadcn DropdownMenu: `npx shadcn-vue@latest add dropdown-menu`.
  - Refactor context menu trong `ExplorerPanel.vue`: bỏ Teleport + hand-rolled `.ctx-menu`, thay bằng `<DropdownMenu>` trigger on right-click.
  - Giữ nguyên toàn bộ menu items hiện có.
* **Complexity:** Trung bình

#### S-SD4 — Migration: Dialog (Modal)
* **Goal:** Chuyển `SettingsModal.vue` và `UpdateModal.vue` sang shadcn Dialog.
* **Scope:**
  - Add shadcn Dialog: `npx shadcn-vue@latest add dialog`.
  - Wrap modal content trong `<DialogContent>`, giữ nguyên form/layout bên trong.
  - Tận dụng built-in focus trap và Esc-to-close.
* **Complexity:** Trung bình

#### S-SD5 — Migration: Input & Tooltip (Opportunistic)
* **Goal:** Nâng cấp các interactive input fields và tooltips.
* **Scope:**
  - Add shadcn Input, Tooltip.
  - Áp dụng cho `InlineFilenameInput.vue` và các icon buttons trong toolbar.
* **Complexity:** Thấp

---

## 3. FEATURE 1: Open Terminal from File (Context Menu Tree)

### 3.1 Phân tích gốc rễ

Người dùng khi làm việc trong workspace nhiều folder lồng nhau thường cần mở terminal tại thư mục chứa file đang chọn — ví dụ để chạy script, git, hoặc build command. Hiện tại terminal luôn mở tại thư mục gốc workspace (`rootPath`), không có cách nào nhanh để navigate đến folder con.

Tính năng **"Open terminal from file"** trong right-click context menu sẽ giải quyết workflow này: click phải vào file/folder → chọn → terminal mở tại đúng thư mục đó.

### 3.2 Giải pháp & Bản thiết kế

**Luồng xử lý:**
1. Right-click vào tree node (file hoặc folder) → context menu hiển thị thêm item "Open Terminal Here"
2. Khi click: tính đường dẫn thư mục mục tiêu:
   - Nếu là folder → dùng `path` trực tiếp
   - Nếu là file → dùng `parentOf(path)`
3. Gọi action mở bottom panel terminal (toggle nếu đang ẩn)
4. Spawn PTY session mới với `cwd` = thư mục đích

**Approach:** Extend Rust command `pty_spawn` để nhận tham số `cwd: Option<String>`. Frontend gọi `pty_spawn` với `cwd` = thư mục đích → shell khởi động tại đúng thư mục.

### 3.3 Stories

#### S-OT1 — Rust: Bổ sung tham số `cwd` cho `pty_spawn`
* **Goal:** Cho phép spawn PTY tại bất kỳ thư mục nào, không chỉ workspace root.
* **Scope:**
  - Sửa `pty_spawn` trong `src-tauri/src/lib.rs`: thêm tham số `cwd: Option<String>`, nếu `Some` thì set working directory khi spawn shell process.
  - Update `invoke_handler![]` và `default.json` nếu cần.
* **Complexity:** Thấp

#### S-OT2 — UI: Context menu item "Open Terminal Here"
* **Goal:** Thêm option vào right-click menu trên tree node (cả file lẫn folder).
* **Scope:**
  - Thêm `ctxOpenTerminal()` function trong `ExplorerPanel.vue`: tính `targetDir`, show bottom panel (`ui.showBottomPanel()`), gọi spawn terminal mới với `cwd = targetDir`.
  - Thêm menu item vào context menu template (sau phần separator hiện tại).
  - Thêm i18n key `ctx.openTerminalHere`.
* **Complexity:** Thấp

---

## 4. FEATURE 2: Tính năng mới lấy cảm hứng từ Obsidian

### 4.1 Phân tích & Đề xuất

Nghiên cứu các tính năng của **Obsidian** dưới góc độ phù hợp với kiến trúc mdview. Danh sách đề xuất theo độ ưu tiên và độ khả thi:

---

#### 4.1.1 ⭐⭐⭐ Backlinks — Liên kết ngược giữa các tài liệu

**Vấn đề giải quyết:** Obsidian nổi tiếng với `[[wiki links]]` và panel "Backlinks" — người dùng có thể nhìn thấy "tài liệu nào đang link đến tài liệu này". Trong hệ sinh thái ghi chú kết nối kiến thức, backlinks là tính năng cốt lõi.

**Hướng triển khai:**
- Rust command `find_backlinks(file_path, workspace_roots)`: quét toàn bộ `.md` files, tìm các `[[filename]]` hoặc `[text](relative_link)` trỏ đến file hiện tại.
- Hiển thị trong sidebar panel "Backlinks" (tab mới) hoặc dưới cùng Preview pane.
- Click vào backlink → mở file đó.

**Complexity:** Trung bình | **Impact:** Cao

---

#### 4.1.2 ⭐⭐⭐ Wikilink Syntax (`[[file]]`) Autocomplete

**Vấn đề giải quyết:** Obsidian cho phép gõ `[[` để trigger popup autocomplete tên file trong workspace — giúp tạo liên kết giữa tài liệu nhanh chóng.

**Hướng triển khai:**
- CodeMirror 6 extension: lắng nghe khi người dùng gõ `[[`, hiển thị dropdown danh sách file trong workspace (lấy từ `workspace.allFiles`).
- Khi chọn → insert `[[filename]]` hoặc `[display](relative_path)`.
- Phím tắt: `]]` để đóng hoặc `Enter` để confirm.

**Complexity:** Trung bình | **Impact:** Cao

---

#### 4.1.3 ⭐⭐ Quick Switcher nâng cao (Recent + Fuzzy + Heading Search)

**Vấn đề giải quyết:** Command Palette hiện tại đã có fuzzy search tên file. Obsidian nâng cấp thêm: hiển thị Recent files đầu tiên, và cho phép tìm theo tiêu đề heading bên trong file.

**Hướng triển khai:**
- Mở rộng `CommandPalette.vue`: thêm section "Recent" (lấy từ `tabs.recentFiles`).
- Thêm heading search mode: khi gõ `#keyword`, tìm kiếm trong TOC headings của file đang mở.

**Complexity:** Thấp | **Impact:** Trung bình

---

#### 4.1.4 ⭐⭐ Templates cho tài liệu mới

**Vấn đề giải quyết:** Obsidian có Template plugin cho phép insert nội dung mẫu khi tạo file mới (meeting note template, project template...).

**Hướng triển khai:**
- Trong Settings: chọn "Templates folder" trong workspace.
- Khi tạo file mới, nếu có templates → dropdown chọn template.
- Template hỗ trợ placeholder: `{{date}}`, `{{title}}`, `{{time}}`.
- Tích hợp tốt với Daily Notes đã có ở v1.6.0.

**Complexity:** Trung bình | **Impact:** Trung bình

---

#### 4.1.5 ⭐ Focus Mode / Zen Mode

**Vấn đề giải quyết:** Obsidian có chế độ tập trung ẩn toàn bộ UI, chỉ hiện editor. Giúp viết không bị phân tâm.

**Hướng triển khai:**
- Phím tắt `Cmd+Shift+Z` → ẩn sidebar, tabbar, toolbar — chỉ còn editor fullscreen.
- Toggle lại bằng cùng phím tắt hoặc `Esc`.

**Complexity:** Thấp | **Impact:** Thấp–Trung bình

---

### 4.2 Stories được đề xuất đưa vào v1.7.0

Dựa trên cân nhắc giá trị/nỗ lực, **đề xuất đưa 2 tính năng** vào v1.7.0:

#### S-OB1 — Wikilink `[[]]` Autocomplete trong Editor
* **Goal:** Gõ `[[` trong editor trigger popup chọn file trong workspace.
* **Scope:**
  - Viết CodeMirror 6 extension `wikilinkCompletion` trong `src/extensions/wikilinkCompletion.ts`.
  - Lắng nghe character input `[[`, query danh sách file từ `workspace.allFiles`.
  - Hiển thị CM6 completion popup, insert `[[filename]]` khi confirm.
  - Register extension trong `SourceEditor.vue`.
* **Complexity:** Trung bình (Front-end only)

#### S-OB2 — Quick Switcher: Recent Files & Heading Search
* **Goal:** Nâng cấp Command Palette hiện tại với Recent và Heading search.
* **Scope:**
  - Thêm section "Recent" vào đầu `CommandPalette.vue`, hiển thị 5 file gần nhất từ `tabs`.
  - Thêm mode: khi input bắt đầu bằng `#`, search trong TOC headings của tất cả file đã mở.
* **Complexity:** Thấp (Front-end only)

---

## 5. RESEARCH: Graph View — Hiển thị đồ thị phụ thuộc tài liệu

### 5.1 Mục tiêu nghiên cứu

Đánh giá **tính khả thi kỹ thuật** của tính năng hiển thị đồ thị liên kết giữa các file `.md` trong workspace, tương tự Graph View của Obsidian. Cung cấp bức tranh toàn cảnh về cấu trúc kiến thức.

### 5.2 Phân tích kỹ thuật

#### 5.2.1 Dữ liệu nguồn — Link extraction

Để vẽ graph, cần biết: "file A link đến file B". Các loại link cần parse:
- `[[filename]]` (wiki link — sẽ có sau S-OB1)
- `[text](relative/path.md)` (markdown link chuẩn)
- `[text](absolute/path.md)` (ít phổ biến)

**Approach:** Rust command `build_link_graph(workspace_roots)` — quét tất cả `.md`, trích xuất links bằng regex, trả về adjacency list: `HashMap<String, Vec<String>>`.

#### 5.2.2 Render graph — Frontend

| Option | Ưu điểm | Nhược điểm |
|--------|---------|------------|
| **D3.js** | Linh hoạt, force simulation đẹp, nhiều ví dụ Obsidian-like | Bundle ~250KB |
| **Cytoscape.js** | API graph native, layout phong phú | Bundle tương đương D3 |
| **vis-network** | Easy API, physics built-in | Ít customizable |
| **SVG thuần** | Zero dependency | Tốn công implement |

**Kết luận:** **D3.js** dynamic import (không ảnh hưởng cold start) là lựa chọn tốt nhất.

#### 5.2.3 UI Integration

- Tab mới trong sidebar activity row (icon: `lucide:network`)
- Hoặc Full-screen panel toggle `Cmd+G`
- Interactions: hover highlight connections, click mở file, zoom/pan, filter theo file hiện tại

#### 5.2.4 Performance considerations

- Rust side: cache link graph, chỉ re-scan khi file system thay đổi
- Frontend: chỉ render khi Graph tab active (lazy)
- Progressive loading: hiện graph 1-hop của file hiện tại trước, full graph là opt-in

### 5.3 Kết luận Nghiên cứu Khả thi

| Tiêu chí | Đánh giá |
|----------|----------|
| **Kỹ thuật khả thi** | ✅ Hoàn toàn khả thi |
| **Phụ thuộc mới** | D3.js (dynamic import) |
| **Rust backend mới** | `build_link_graph` command |
| **Complexity tổng** | Cao (~2–3 sprints để đạt chất lượng Obsidian-level) |
| **Prerequisite** | Backlinks + Wikilink (S-OB1) nên có trước |
| **Khuyến nghị** | ⏳ Đưa vào **v1.8.0** sau khi backlink data layer sẵn sàng |

> **📌 Quyết định:** Không đưa Graph View vào v1.7.0. Thực hiện research/prototype trong sprint này, GA ở v1.8.0.

---

## 6. Tổng hợp Kế hoạch Triển khai v1.7.0

### Dependency Graph

```
Bug Fixes ──────┬──▶ S-BF1 (Newline fix — độc lập)
                ├──▶ S-BF2 (Checkbox & List CSS — độc lập)
                └──▶ S-BF3 (Auto-expand folder — độc lập)

shadcn Setup ───▶ S-SD1 ──▶ S-SD2 ──▶ S-SD3 ──▶ S-SD4 ──▶ S-SD5
                            (sequential, mỗi bước độc lập sau SD1)

Terminal ───────▶ S-OT1 ──▶ S-OT2

Obsidian-like ──┬──▶ S-OB1 (Wikilink autocomplete)
                └──▶ S-OB2 (Quick Switcher nâng cao — độc lập)

Research ───────▶ Graph View prototype (không ship v1.7.0)
```

### Complexity & Impact Matrix

| Story | Feature | Complexity | Rust? | Priority |
|-------|---------|------------|-------|----------|
| S-BF1 | Fix newline rendering | Thấp | ❌ | 🔴 Phải có |
| S-BF2 | Fix checkbox & list CSS | Thấp | ❌ | 🔴 Phải có |
| S-BF3 | Auto-expand folder khi new file | Thấp | ❌ | 🔴 Phải có |
| S-SD1 | shadcn/vue init + theme bridge | Trung bình | ❌ | 🟠 Cao |
| S-SD2 | shadcn Button migration | Thấp | ❌ | 🟠 Cao |
| S-SD3 | shadcn DropdownMenu (ctx menu) | Trung bình | ❌ | 🟠 Cao |
| S-SD4 | shadcn Dialog (modals) | Trung bình | ❌ | 🟡 Trung bình |
| S-SD5 | shadcn Input & Tooltip | Thấp | ❌ | 🟡 Trung bình |
| S-OT1 | pty_spawn cwd param (Rust) | Thấp | ✅ | 🟠 Cao |
| S-OT2 | "Open Terminal Here" ctx menu | Thấp | ❌ | 🟠 Cao |
| S-OB1 | Wikilink `[[]]` autocomplete | Trung bình | ❌ | 🟡 Trung bình |
| S-OB2 | Quick Switcher: Recent + Heading | Thấp | ❌ | 🟡 Trung bình |

### New Files Expected

```
src/extensions/wikilinkCompletion.ts    (S-OB1) — CM6 wikilink extension
src/components/ui/                      (S-SD*) — shadcn/vue components
  ├── button.vue
  ├── dropdown-menu.vue
  ├── dialog.vue
  ├── input.vue
  └── tooltip.vue
components.json                         (S-SD1) — shadcn config
```

### Modified Files Expected

```
src/styles/main.scss                    (S-SD1) — theme bridge variables
src/styles/_variables.scss             (S-SD1) — shadcn token mapping
src/components/PreviewPane.vue         (S-BF1, S-BF2) — MarkdownIt config + CSS
src/components/ExplorerPanel.vue       (S-BF3, S-OT2, S-SD3) — ctx menu
src/components/FileTreeNode.vue        (S-BF3) — auto-expand logic
src/components/CommandPalette.vue      (S-OB2) — recent + heading search
src/components/SourceEditor.vue        (S-OB1) — register wikilink extension
src/components/SettingsModal.vue       (S-SD4) — Dialog migration
src/components/UpdateModal.vue         (S-SD4) — Dialog migration
src/stores/workspace.ts                (S-BF3) — ensureDirExpanded method
src-tauri/src/lib.rs                   (S-OT1) — pty_spawn cwd param
src-tauri/capabilities/default.json   (S-OT1) — update nếu cần
package.json                           (S-SD1) — shadcn dependencies
```

### Thứ tự triển khai được đề xuất

1. **Tuần 1:** Bug fixes (S-BF1, S-BF2, S-BF3) — ship nhanh, không có dependency
2. **Tuần 1–2:** shadcn setup + Button + DropdownMenu (S-SD1 → S-SD2 → S-SD3)
3. **Tuần 2:** Terminal "Open Here" (S-OT1 → S-OT2) — đơn giản, high value
4. **Tuần 2–3:** shadcn Dialog + Input/Tooltip (S-SD4, S-SD5)
5. **Tuần 3:** Obsidian features (S-OB1, S-OB2)
6. **Ongoing:** Graph View research/prototype — không block release v1.7.0
