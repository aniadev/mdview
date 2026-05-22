---
title: "mdview v1.8.0 — Feature Breakdown"
version: 1.8.0
created: 2026-05-22
status: planning
---

# v1.8.0 Feature Breakdown

Phiên bản tập trung vào **Knowledge Graph & Document Intelligence** — biến bộ sưu tập file `.md` rời rạc thành đồ thị tri thức có thể quan sát và điều hướng. Lấy cảm hứng từ Obsidian Graph View + Backlinks và Confluence Page Templates + Properties.

**Prerequisite từ v1.7.0:** Wikilink `[[` autocomplete, shadcn/vue design system, Quick Switcher nâng cao.

---

## 0. COMPETITIVE ANALYSIS: Obsidian & Confluence Gap

### 0.1 Obsidian — Feature Gap

mdview đã có: File explorer, Wikilink autocomplete, Quick Switcher, Daily Notes, Full-text search, Tabs, Split view, Outline, Dark/Light theme.

| Obsidian Feature | Gap Status | Value | Effort | v1.8.0? |
|---|---|---|---|---|
| Graph View (local + global) | ❌ Missing | 🔴 Cao | 🔴 Cao | ✅ Headliner |
| Backlinks panel | ❌ Missing | 🔴 Cao | 🟡 TB | ✅ Headliner |
| Properties / Frontmatter editor | ❌ Missing | 🔴 Cao | 🟡 TB | ✅ Tier 2 |
| Tags pane | ❌ Missing | 🟡 TB | 🟢 Thấp | ✅ Tier 3 |
| Callouts / Admonitions | ❌ Missing | 🟡 TB | 🟢 Thấp | ✅ Tier 3 |
| Page Templates | ❌ Missing | 🔴 Cao | 🟡 TB | ✅ Tier 2 |
| Canvas (infinite space) | ❌ Missing | 🟡 TB | 🔴 Cao | ❌ Out of scope |
| Community plugins | ❌ Missing | 🟢 Thấp | 🔴 Cao | ❌ Out of scope |

### 0.2 Confluence — Feature Gap

| Confluence Feature | Gap Status | Value | Effort | v1.8.0? |
|---|---|---|---|---|
| Page Templates / Blueprints | ❌ Missing | 🔴 Cao | 🟡 TB | ✅ Tier 2 |
| Export to PDF | ❌ Missing | 🟡 TB | 🟢 Thấp | ✅ Tier 3 |
| Page Properties / Labels | ❌ Missing | 🟡 TB | 🟡 TB | ✅ Overlap với Frontmatter |
| Page History / Version diff | ❌ Missing | 🟡 TB | 🟡 TB | ⏳ Research only |
| Decision log / Meeting notes | ❌ Missing | 🟡 TB | 🟢 Thấp | ✅ Template-driven |
| Real-time collaboration | ❌ Missing | - | 🔴 Cao | ❌ Out of scope |
| Comments / @mentions | ❌ Missing | - | - | ❌ Không có user system |
| Jira integration | ❌ Missing | - | 🔴 Cao | ❌ Out of scope |

---

## 1. FEATURE: Graph View — Đồ thị liên kết tài liệu

### 1.1 Phân tích gốc rễ

Sau khi có wikilink `[[` autocomplete (v1.7.0 S-OB1), người dùng có thể tạo liên kết giữa các file nhanh chóng. Tuy nhiên, không có cách nào để **nhìn thấy** bức tranh tổng thể về mối quan hệ giữa các tài liệu. Obsidian nổi tiếng với Graph View — tính năng khác biệt hóa cốt lõi cho phép người dùng quan sát cấu trúc tri thức.

**Vấn đề:**
- Người dùng tạo `[[link]]` nhưng không biết file nào đang link đến đâu
- Không có cách trực quan để khám phá "hòn đảo" tài liệu cô lập
- Thiếu cái nhìn toàn cảnh về độ kết nối của workspace

### 1.2 Giải pháp & Bản thiết kế

**Kiến trúc tổng thể:**

```
┌─ Rust Backend ─────────────────────────────┐
│  build_link_graph(roots)                    │
│    ├─ Walk all .md files                    │
│    ├─ Parse [[wikilink]] + [md](link)       │
│    ├─ Resolve relative paths                │
│    └─ Return adjacency list + metadata      │
│                                             │
│  find_backlinks(file, roots)                │
│    └─ Query cached graph for inbound links  │
└─────────────────────────────────────────────┘
           │ invoke()
           ▼
┌─ Frontend ──────────────────────────────────┐
│  graph.ts store                             │
│    ├─ state: LinkGraph (cached)             │
│    ├─ refreshGraph()                        │
│    └─ getBacklinks(file, roots)             │
│                                             │
│  GraphPanel.vue                             │
│    ├─ <svg> with D3 force simulation        │
│    ├─ Hover: highlight edges                │
│    ├─ Click node: open file                 │
│    ├─ Zoom/Pan                              │
│    └─ Filter: local graph 1-hop / full      │
└─────────────────────────────────────────────┘
```

**Link types cần parse:**
1. `[[filename]]` — wiki link (đã có autocomplete từ v1.7.0)
2. `[[filename|display]]` — wiki link với alias
3. `[text](relative/path.md)` — markdown link chuẩn
4. `[text](relative/path.md#heading)` — link đến heading cụ thể

**Graph types:**
- **Local Graph** (mặc định): Chỉ hiển thị node file đang active + 1-hop neighbors + edges giữa các neighbors
- **Full Graph** (opt-in): Toàn bộ workspace — button "Show all"

**D3.js Integration:**
- Dynamic import (`import('d3')`) — không bundle vào entry, không ảnh hưởng cold start
- Force simulation: `d3.forceSimulation` với `forceLink`, `forceManyBody`, `forceCenter`, `forceCollide`
- Node size tỉ lệ với số lượng connection (degree centrality)
- Edge opacity tỉ lệ với link frequency

### 1.3 Stories

#### S-GV1 — Rust: Command `build_link_graph`
* **Goal:** Quét toàn bộ workspace và trả về adjacency list quan hệ giữa các file.
* **Scope:**
  - Thêm command `build_link_graph(roots: Vec<String>) -> LinkGraph` trong `src-tauri/src/lib.rs`.
  - `LinkGraph` struct: `nodes: Vec<GraphNode>` (path, label, degree), `edges: Vec<GraphEdge>` (source, target, type, line_number).
  - Parse regex: `\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]` cho wikilink, `\[([^\]]*)\]\(([^)]+\.md[^)]*)\)` cho markdown link.
  - Resolve relative paths → absolute để match node identity.
  - Multi-threaded file scan với `rayon` (đã có dependency từ `search_workspace`).
  - Cache result trong Rust state, invalidate khi file system thay đổi.
  - Update `invoke_handler![]` và `default.json`.
* **Complexity:** Trung bình–Cao (Rust)

#### S-GV2 — Frontend: `graph.ts` Store + Data Layer
* **Goal:** Pinia store quản lý link graph data, cache, và refresh logic.
* **Scope:**
  - Tạo `src/stores/graph.ts`: state `graph: LinkGraph | null`, `loading`, `error`.
  - Method `refreshGraph()` — gọi `build_link_graph` từ Rust.
  - Method `getBacklinks(filePath: string)` — lọc inbound edges từ graph.
  - Method `getLocalGraph(filePath: string, hops: number)` — subgraph xung quanh file.
  - Watch `workspace.roots` để auto-refresh.
  - Debounce refresh sau file save (500ms).
* **Complexity:** Thấp (Frontend)

#### S-GV3 — Frontend: `GraphPanel.vue` — D3.js Force Graph UI
* **Goal:** Hiển thị đồ thị tương tác trong sidebar panel.
* **Scope:**
  - Tạo `src/components/GraphPanel.vue` với `<svg>` container.
  - Dynamic import D3.js khi component mount: `const d3 = await import('d3')`.
  - Force simulation: nodes + edges với physics parameters.
  - Node rendering: circle + label bên dưới, màu theo số lượng connection.
  - Edge rendering: line với opacity dựa trên link type.
  - Interactions:
    - **Hover node:** highlight node + connected edges, tooltip hiển thị path
    - **Click node:** `tabs.openFile(node.path)`
    - **Drag node:** reposition (fixed position trong simulation)
    - **Zoom/Pan:** `d3.zoom()` transform trên `<g>` container
    - **Double-click background:** reset zoom
  - Controls: toggle giữa Local Graph / Full Graph.
  - Search box trong panel: highlight node theo tên file.
  - Placeholder: "No wikilinks found. Start by adding `[[links]]` in your notes."
  - Loading state: spinner khi đang scan workspace.
* **Complexity:** Cao (Frontend — D3.js integration)

#### S-GV4 — UI Integration: Sidebar Tab + Activity Row
* **Goal:** Thêm Graph tab vào sidebar activity row, bên cạnh Explorer / Outline / Search.
* **Scope:**
  - Thêm `"graph"` vào `ui.sidebarView` union type.
  - Thêm nút trong `ExplorerPanel.vue` activity row với icon `lucide:network`.
  - `Sidebar.vue` render `<GraphPanel>` khi `sidebarView === "graph"`.
  - Thêm i18n key `explorer.graph`.
* **Complexity:** Thấp

---

## 2. FEATURE: Backlinks Panel — Liên kết ngược

### 2.1 Phân tích gốc rễ

Obsidian Backlinks panel hiển thị "những tài liệu nào đang link đến tài liệu này". Tính năng này là mảnh ghép còn thiếu trong hệ sinh thái wikilink: người dùng có thể tạo link đi (outgoing) thông qua autocomplete, nhưng không thể thấy link đến (incoming). Backlinks giúp khám phá mối quan hệ ngược — tài liệu nào tham chiếu đến ý tưởng hiện tại.

### 2.2 Giải pháp & Bản thiết kế

**Data source:** Dùng chung `build_link_graph` từ S-GV1 hoặc command riêng `find_backlinks` để tối ưu (chỉ scan một lần, cache trong Rust).

**UI Design:**
- Panel hiển thị trong sidebar hoặc section dưới PreviewPane
- Mỗi backlink entry hiển thị:
  - Tên file nguồn (clickable → mở file)
  - Context snippet: dòng chứa link + 1-2 dòng xung quanh
  - Badge loại link: `[[]]` wikilink hoặc `[]()` markdown link
- Group by file nguồn, sắp xếp theo số lượng link giảm dần
- Empty state: "No backlinks found. Other notes will appear here when they link to this file."

**Vị trí:** Dưới cùng PreviewPane (giống Obsidian) hoặc tab riêng trong sidebar. Đề xuất: section dưới Preview để ngữ cảnh gần với nội dung đang xem.

### 2.3 Stories

#### S-BL1 — Rust: Command `find_backlinks`
* **Goal:** Trả về danh sách file + context snippet của tất cả link inbound đến file hiện tại.
* **Scope:**
  - Thêm command `find_backlinks(file_path: String, roots: Vec<String>) -> Vec<BacklinkEntry>`.
  - `BacklinkEntry` struct: `from_file` (path), `from_label` (display name), `link_type` ("wiki" | "md"), `line_number`, `context` (dòng chứa link + 1 dòng trước/sau).
  - Nếu `LinkGraph` đã được cache (từ S-GV1), query trực tiếp từ cache thay vì scan lại.
  - Update `invoke_handler![]` và `default.json`.
* **Complexity:** Thấp (phụ thuộc S-GV1 data layer)

#### S-BL2 — Frontend: `BacklinksPanel.vue`
* **Goal:** Hiển thị danh sách backlink với context snippet trong panel.
* **Scope:**
  - Tạo `src/components/BacklinksPanel.vue`: lắng nghe `tabs.activePath`, gọi `find_backlinks`.
  - Render danh sách: mỗi mục có icon link type + from_label + context snippet.
  - Click backlink → mở file nguồn và scroll đến dòng chứa link.
  - Loading skeleton khi đang fetch.
  - Empty state message.
  - Refresh khi switch tab.
* **Complexity:** Thấp

#### S-BL3 — UI Integration: Backlinks trong PreviewPane hoặc Sidebar
* **Goal:** Tích hợp Backlinks panel vào giao diện.
* **Scope:**
  - Option A: Thêm section `<BacklinksPanel>` vào cuối `PreviewPane.vue`, dưới nội dung markdown.
  - Option B: Thêm tab "Backlinks" trong sidebar activity row.
  - Đề xuất: Option A (dưới Preview) — giữ ngữ cảnh gần nội dung, giống Obsidian.
  - Style consistent với PreviewPane, border-top separator.
* **Complexity:** Thấp

---

## 3. FEATURE: Frontmatter / Properties Editor

### 3.1 Phân tích gốc rễ

YAML frontmatter là chuẩn để lưu metadata trong file markdown (`---` block ở đầu file). Hiện tại mdview hiển thị raw YAML trong editor — người dùng phải tự gõ cú pháp YAML chính xác. Không có UI trực quan để xem/sửa metadata.

**Vấn đề:**
- Dễ sai cú pháp YAML (indent, dấu ngoặc)
- Không có gợi ý các field chuẩn: `tags`, `date`, `aliases`, `created`, `updated`
- Không tích hợp với Daily Notes (tự động điền `date`, `tags`)
- Mất cơ hội hiển thị metadata dạng structured trong UI

### 3.2 Giải pháp & Bản thiết kế

**Luồng dữ liệu hai chiều:**

```
Editor (CM6)                    PropertiesPanel
    │                                │
    │ ── text content ──▶ parseYAML() │
    │                                │
    │ ◀── CM6 transaction ◀─ serializeYAML()
    │                                │
```

- **Parse:** Khi mở file hoặc switch tab → parse YAML block đầu file → hiển thị trong PropertiesPanel
- **Edit:** Người dùng sửa field trong PropertiesPanel → generate YAML block mới → áp dụng qua CM6 transaction (chỉ thay thế frontmatter block, giữ nguyên phần thân)
- **Sync:** Nếu người dùng gõ trực tiếp vào YAML trong editor → debounce 500ms → re-parse → cập nhật PropertiesPanel

**Field types hỗ trợ:**
| Type | UI Control | Ví dụ |
|------|-----------|-------|
| `text` | Text input | `title: My Note` |
| `date` | Date picker | `date: 2026-05-22` |
| `datetime` | Datetime picker | `created: 2026-05-22T10:30:00` |
| `tags` | Tag input (multi-select) | `tags: [idea, draft]` |
| `aliases` | Tag input | `aliases: [another name]` |
| `number` | Number input | `priority: 3` |
| `boolean` | Checkbox / Toggle | `published: true` |
| `list` | Multi-line textarea | `authors:\n  - Alice\n  - Bob` |

**Tích hợp Daily Notes:** Khi tạo daily note qua `Alt+D`, tự động điền frontmatter:
```yaml
---
date: 2026-05-22
tags: [daily]
---
```

### 3.3 Stories

#### S-FM1 — Utilities: YAML Frontmatter Parser/Serializer
* **Goal:** Hàm utility parse và serialize YAML frontmatter block.
* **Scope:**
  - Tạo `src/utils/frontmatter.ts`:
    - `parseFrontmatter(text: string): { fields: Record<string, any>, bodyStart: number, bodyEnd: number } | null`
    - `serializeFrontmatter(fields: Record<string, any>): string` — tạo YAML block với `---` delimiter
    - `applyFrontmatter(text: string, fields: Record<string, any>): string` — thay thế frontmatter block trong text, giữ nguyên body
  - Sử dụng `js-yaml` library (đã có trong hệ sinh thái npm, kiểm tra `package.json`).
  - Xử lý edge case: file không có frontmatter → thêm block mới vào đầu.
  - Xử lý edge case: YAML parse error → hiển thị warning, không crash.
* **Complexity:** Thấp–Trung bình

#### S-FM2 — Store: `properties.ts`
* **Goal:** Pinia store quản lý state frontmatter của file đang active.
* **Scope:**
  - Tạo `src/stores/properties.ts`: state `fields: Record<string, any> | null`, `hasFrontmatter: boolean`.
  - Watch `tabs.activePath` → re-parse frontmatter từ `tabs.activeTab.content`.
  - Method `updateField(key: string, value: any)` → cập nhật field → serialize → gọi `tabs.setContent()` (với CM6 transaction trong tương lai).
  - Method `addField(key: string, type: string)` → thêm field mới.
  - Method `removeField(key: string)` → xóa field.
  - Method `getTags(): string[]` → trích xuất `tags` field dạng array.
  - Debounce sync từ editor thay đổi (500ms) để tránh loop.
* **Complexity:** Trung bình

#### S-FM3 — Component: `PropertiesPanel.vue`
* **Goal:** Giao diện form chỉnh sửa frontmatter với field type-aware controls.
* **Scope:**
  - Tạo `src/components/PropertiesPanel.vue`:
    - Render danh sách field với label + input control theo type
    - Button "Add property" → dropdown chọn type → tạo field mới
    - Context menu trên field: Edit key, Change type, Delete
    - Drag để sắp xếp lại thứ tự field
    - Collapsible panel (toggle hiện/ẩn)
  - Vị trí: Dưới toolbar trong `EditorArea.vue` hoặc sidebar tab "Properties"
  - Đề xuất: Sidebar tab — giữ editor sạch, không chiếm vertical space
  - Empty state: file không có frontmatter → "No properties. Click '+' to add tags, dates, or custom fields."
  - i18n keys: `properties.title`, `properties.add`, `properties.empty`, `properties.editKey`, `properties.delete`
* **Complexity:** Trung bình–Cao (nhiều field types)

#### S-FM4 — Integration: Sidebar Tab + Daily Notes Auto-fill
* **Goal:** Tích hợp Properties Panel vào sidebar và tự động điền frontmatter cho Daily Notes.
* **Scope:**
  - Thêm sidebar tab "Properties" (icon: `lucide:file-cog`) vào activity row.
  - `Sidebar.vue` render `<PropertiesPanel>` khi `sidebarView === "properties"`.
  - `workspace.openDailyNote()`: Sau khi tạo file, kiểm tra template hoặc tự động chèn frontmatter mặc định:
    ```yaml
    ---
    date: YYYY-MM-DD
    tags: [daily]
    ---
    ```
  - Tích hợp với Templates (S-TP1): Nếu template daily note có frontmatter → merge với auto-fill fields.
* **Complexity:** Thấp

---

## 4. FEATURE: Page Templates

### 4.1 Phân tích gốc rễ

Obsidian Templates và Confluence Blueprints cho phép chọn template khi tạo tài liệu mới. Hiện tại `create_md_file` chỉ tạo file trống. Người dùng phải tự copy-paste cấu trúc lặp lại (meeting notes, project docs, daily logs).

**Vấn đề:**
- Tạo file mới luôn trống, không có cấu trúc sẵn
- Mỗi lần tạo meeting note phải tự gõ lại agenda, attendees...
- Daily note đã có auto-template nhưng không customize được
- Không có cách tái sử dụng cấu trúc tài liệu

### 4.2 Giải pháp & Bản thiết kế

**Cơ chế:**
1. Người dùng tạo folder `_templates/` trong workspace (default) hoặc chọn folder template trong Settings
2. Đặt các file `.md` mẫu trong folder: `meeting.md`, `project.md`, `daily.md`...
3. Template hỗ trợ placeholder variables:
   - `{{date}}` → YYYY-MM-DD
   - `{{time}}` → HH:mm
   - `{{datetime}}` → YYYY-MM-DD HH:mm
   - `{{title}}` → tên file (không có extension)
4. Khi người dùng chọn "New File":
   - Nếu templates folder tồn tại và có ít nhất 1 template → hiển thị dropdown "Choose template" hoặc "Empty file"
   - Nếu chỉ có 1 template `default.md` → dùng luôn, không cần hỏi
   - Nếu không có template → giữ nguyên flow cũ (file trống)

**Tích hợp đặc biệt:**
- `_templates/daily.md` → tự động dùng cho Daily Notes (ghi đè template mặc định)
- Templates folder có thể đặt ở workspace root hoặc subfolder, cấu hình trong Settings

### 4.3 Stories

#### S-TP1 — Rust: Mở rộng `create_md_file` hỗ trợ template
* **Goal:** Khi tạo file mới, có thể chọn template để pre-fill nội dung.
* **Scope:**
  - Sửa `create_md_file` trong `src-tauri/src/lib.rs`: thêm optional param `template_path: Option<String>`.
  - Nếu `Some(template_path)` → đọc nội dung file template → substitute placeholder variables → ghi vào file mới.
  - Placeholder substitution trong Rust: regex `\{\{(\w+)\}\}` → map với context vars (date, time, datetime, title).
  - Trả về đường dẫn file đã tạo (giữ nguyên behavior).
  - Update `invoke_handler![]` và `default.json`.
* **Complexity:** Thấp (Rust — small extension)

#### S-TP2 — Frontend: `TemplateChooser.vue`
* **Goal:** Dropdown chọn template khi tạo file mới.
* **Scope:**
  - Tạo `src/components/TemplateChooser.vue`: modal nhỏ hoặc dropdown hiển thị danh sách template.
  - Mỗi template item: icon + tên file + preview 2 dòng đầu nội dung.
  - Option "Empty file" ở đầu danh sách (mặc định).
  - Keyboard: Enter chọn, Escape hủy (về Empty file).
  - Load danh sách template từ `list_md_files(templatesFolder)`.
* **Complexity:** Thấp

#### S-TP3 — Integration: New File Flow + Settings
* **Goal:** Tích hợp template vào flow tạo file và thêm setting cấu hình.
* **Scope:**
  - `ExplorerPanel.vue`: Trong `ctxNewFile()` và `startRootCreate()`, kiểm tra templates folder.
  - Nếu có template → hiển thị `TemplateChooser` → sau khi chọn, gọi `create_md_file` với `template_path`.
  - Nếu không có template → flow cũ.
  - `SettingsModal.vue`: Thêm setting "Templates folder" (input path, mặc định `_templates/`).
  - Persist setting `template_folder` vào `mdview-settings.json`.
  - `workspace.openDailyNote()`: Kiểm tra `_templates/daily.md`, nếu tồn tại → dùng làm template.
  - i18n keys: `settings.templateFolder`, `settings.templateFolderDesc`, `ctx.chooseTemplate`, `template.empty`.
* **Complexity:** Trung bình

---

## 5. FEATURE: Callouts / Admonitions

### 5.1 Phân tích gốc rễ

Obsidian Callouts (`> [!note]`, `> [!warning]`, `> [!info]`...) là syntax mở rộng từ GFM blockquote để tạo block chú thích có màu sắc và icon. Cú pháp tương thích ngược: render bình thường trong markdown viewer khác (vẫn là blockquote), nhưng có style đặc biệt trong Obsidian.

**Vấn đề:**
- Không có cách trực quan để highlight thông tin quan trọng trong note
- GFM blockquote đơn điệu, không phân biệt note/warning/tip
- Đây là tính năng "quick win" — effort thấp, visual impact cao

### 5.2 Giải pháp & Bản thiết kế

**Supported callout types:**

| Type | Icon | Màu | Mục đích |
|------|------|-----|----------|
| `note` | lucide:pencil | Xanh | Ghi chú chung |
| `info` | lucide:info | Xanh dương | Thông tin bổ sung |
| `warning` | lucide:triangle-alert | Vàng | Cảnh báo |
| `danger` | lucide:alert-octagon | Đỏ | Nguy hiểm / Lỗi |
| `tip` | lucide:lightbulb | Xanh lá | Mẹo / Gợi ý |
| `success` | lucide:check-circle | Xanh lá | Thành công |
| `example` | lucide:book-open | Tím | Ví dụ |
| `quote` | lucide:quote | Xám | Trích dẫn |

**Syntax:**
```
> [!warning] Tiêu đề tùy chọn
> Nội dung dòng 1
> Nội dung dòng 2
```

**Render pipeline:**
- `PreviewPane.vue` → post-process HTML output của markdown-it
- Regex match blockquote chứa `[!TYPE]` → wrap trong `<div class="callout callout-{type}">`
- CSS: border-left 4px màu type, background 10% opacity màu type, icon bên trái
- Collapsible: Thêm dấu `+`/`-` ở đầu dòng (giống Obsidian), click toggle nội dung

**Toolbar integration:**
- Thêm nút "Insert Callout" trong `SourceEditor.vue` toolbar
- Click → dropdown chọn type → insert template `> [!type] Title\n> Content`

### 5.3 Stories

#### S-CL1 — PreviewPane: Callout Renderer
* **Goal:** Render `> [!type]` syntax thành styled callout blocks trong preview.
* **Scope:**
  - Thêm function `renderCallouts(html: string): string` trong `PreviewPane.vue`.
  - Regex: match `<blockquote>` có nội dung bắt đầu bằng `[!type]`.
  - Replace thành `<div class="callout callout-{type}">` với icon SVG inline.
  - Hỗ trợ collapsible: regex `[!type]+` hoặc `[!type]-` cho expanded/collapsed mặc định.
  - CSS trong `preview.scss`: `.callout` styles cho từng type, responsive.
  - Dark/light theme support qua CSS variables.
* **Complexity:** Thấp

#### S-CL2 — SourceEditor: Insert Callout Toolbar Button
* **Goal:** Thêm nút chèn callout vào editor toolbar.
* **Scope:**
  - Thêm nút trong `SourceEditor.vue` toolbar (icon: `lucide:alert-triangle` hoặc dropdown riêng).
  - Click → dropdown chọn callout type.
  - Insert template với CM6 transaction:
    ```
    > [!{type}] Title
    > Content
    ```
  - Đặt cursor vào "Title" sau khi insert.
  - Thêm i18n keys: `toolbar.callout`, `callout.note`, `callout.warning`, `callout.info`, `callout.tip`, `callout.danger`, `callout.success`, `callout.example`, `callout.quote`.
* **Complexity:** Thấp

---

## 6. FEATURE: Tags Pane

### 6.1 Phân tích gốc rễ

Obsidian Tag pane hiển thị tất cả tag từ vault, sắp xếp theo frequency. Click tag → filter danh sách file có tag đó. Đây là cách tổ chức và khám phá tài liệu theo chủ đề thay vì theo thư mục.

**Vấn đề:**
- Hiện tại chỉ có thể navigate file qua folder tree (hierarchical)
- Không có cách xem "tất cả file về chủ đề X"
- Người dùng đã có thể thêm `tags: [...]` trong frontmatter nhưng không có cách khai thác

### 6.2 Giải pháp & Bản thiết kế

**Tag sources:**
1. Frontmatter `tags: [tag1, tag2]` (ưu tiên — structured)
2. Inline `#tag` trong nội dung (loại trừ heading `# Heading`, code block, URL hash)

**UI Design:**
- Panel trong sidebar (tab "Tags")
- Danh sách tag sắp xếp theo count giảm dần
- Mỗi tag: tên + số lượng file
- Click tag → filter file tree trong ExplorerPanel chỉ hiển thị file có tag đó
- Tag input ở trên cùng để filter nhanh
- Active tag indicator (highlight tag đang filter)

**Rust Implementation:**
- Command `extract_tags(roots: Vec<String>) -> Vec<TagEntry>`
- `TagEntry { tag: String, count: u32, files: Vec<String> }`
- Parse frontmatter YAML: `tags:` field
- Parse inline `#tag`: regex `(?<!\w)#([\w/-]+)` — loại trừ trong code block, heading

### 6.3 Stories

#### S-TG1 — Rust: Command `extract_tags`
* **Goal:** Quét workspace và trả về danh sách tag + file associations.
* **Scope:**
  - Thêm command `extract_tags(roots: Vec<String>) -> Vec<TagEntry>` trong `src-tauri/src/lib.rs`.
  - `TagEntry` struct: `tag: String`, `count: u32`, `files: Vec<String>`.
  - Parse YAML frontmatter `tags:` field (array of strings).
  - Parse inline `#tag` với regex `(?<!\w)#([\w/-]+)`, loại trừ:
    - Code blocks (giữa ``` ```)
    - Heading lines (`# ` prefix — đã có space)
    - URLs (`https://...#anchor`)
  - Deduplicate tags lowercase, count unique files.
  - Sort by count descending.
  - Cache trong Rust state.
  - Update `invoke_handler![]` và `default.json`.
* **Complexity:** Thấp (Rust — straightforward parsing)

#### S-TG2 — Frontend: `TagsPanel.vue`
* **Goal:** Hiển thị danh sách tag với count và khả năng filter.
* **Scope:**
  - Tạo `src/components/TagsPanel.vue`:
    - Search input ở trên để lọc tag.
    - Danh sách tag: mỗi tag là chip/badge có tên + count.
    - Click tag → `emit('select-tag', tag)` — parent component filter file tree.
    - Active tag có style khác biệt, click lần nữa → clear filter.
    - "Clear filter" button khi có active tag.
  - Loading skeleton.
  - Empty state: "No tags found. Add `tags:` in frontmatter or use `#tag` in your notes."
* **Complexity:** Thấp

#### S-TG3 — Integration: Sidebar Tab + File Tree Filter
* **Goal:** Tích hợp Tags Panel vào sidebar và cho phép filter file tree.
* **Scope:**
  - Thêm sidebar tab "Tags" (icon: `lucide:tags`) vào activity row.
  - `Sidebar.vue` render `<TagsPanel>` khi `sidebarView === "tags"`.
  - Khi chọn tag: tự động chuyển `sidebarView` sang `"explorer"` và filter `workspace.roots` chỉ hiển thị file có tag.
  - Indicator "Filtered by: #tagname (X files)" trong ExplorerPanel header.
  - Nút "Clear filter" để trở về toàn bộ file tree.
  - i18n keys: `explorer.tags`, `tags.title`, `tags.noTags`, `tags.filteredBy`, `tags.clearFilter`.
* **Complexity:** Trung bình (cross-component state)

---

## 7. FEATURE: Export to PDF

### 7.1 Phân tích gốc rễ

Confluence cho phép export page ra PDF để chia sẻ hoặc lưu trữ. mdview đã có preview HTML (qua markdown-it) và CSS print styles cơ bản — có thể tận dụng để thêm export PDF.

**Vấn đề:**
- Không có cách xuất tài liệu markdown ra định dạng portable
- Người dùng phải copy-paste sang công cụ khác để in/share

### 7.2 Giải pháp & Bản thiết kế

**Approach 1 — Browser Print API (đề xuất):**
- Render preview ra HTML đầy đủ (inline styles, fonts)
- Mở cửa sổ in trình duyệt với `window.print()`
- Người dùng chọn "Save as PDF" từ dialog in của OS

**Approach 2 — Headless export:**
- Dùng `write_temp_html` (đã có) để tạo file HTML tạm
- Mở trong browser với print dialog

**CSS Print:**
- Ẩn toolbar, sidebar, terminal khi in
- Giữ nguyên preview content + TOC
- Page break giữa các heading level 1
- A4 page size mặc định

### 7.3 Stories

#### S-EX1 — Export PDF Button + Print Styles
* **Goal:** Thêm nút "Export PDF" vào PreviewPane, sử dụng browser print API.
* **Scope:**
  - Thêm nút "Export PDF" trong `PreviewPane.vue` toolbar (icon: `lucide:file-text`).
  - Click → mở `window.print()` với print-specific CSS.
  - Mở rộng print styles trong `src/styles/print.scss`:
    - `@page { size: A4; margin: 2cm; }`
    - Ẩn `.app-header`, `.sidebar`, `.bottom-panel`, `.editor-toolbar`
    - Giữ `.preview-pane` full width
    - Page break: `h1 { page-break-before: always; }` (trừ heading đầu tiên)
  - Thêm i18n key: `preview.exportPdf`.
* **Complexity:** Thấp–Trung bình

---

## 8. RESEARCH: Page History / Version Diff

### 8.1 Mục tiêu nghiên cứu

Đánh giá tính khả thi của việc theo dõi lịch sử thay đổi file và hiển thị diff giữa các phiên bản, lấy cảm hứng từ Confluence Page History.

### 8.2 Phân tích kỹ thuật

| Option | Ưu điểm | Nhược điểm |
|--------|---------|------------|
| **Git-based** | Không cần storage riêng, full history | Phụ thuộc git repo, phức tạp UI |
| **Snapshot folder** (`.mdview-snapshots/`) | Đơn giản, kiểm soát hoàn toàn | Tốn disk, cần cleanup policy |
| **LocalStorage backup** (last N versions) | Nhẹ, dễ implement | Giới hạn số version, mất khi clear |

**Khuyến nghị:**
- **v1.8.0:** Research only — prototype snapshot-based approach, đánh giá UX và storage cost
- **v1.9.0+:** Ship nếu feasible

### 8.3 Kết luận Nghiên cứu Khả thi

| Tiêu chí | Đánh giá |
|----------|----------|
| **Kỹ thuật khả thi** | ✅ |
| **Phụ thuộc mới** | Không (hoặc js-diff nếu dùng diff library) |
| **Rust backend mới** | `save_snapshot`, `list_snapshots`, `get_diff` commands |
| **Complexity tổng** | Trung bình (~1 sprint) |
| **UX risk** | Trung bình — cần design cẩn thận để không gây confusion |
| **Khuyến nghị** | ⏳ Research trong v1.8.0, GA ở v1.9.0 |

> **📌 Quyết định:** Không đưa Page History vào v1.8.0. Thực hiện research/prototype, GA ở v1.9.0.

---

## 9. Tổng hợp Kế hoạch Triển khai v1.8.0

### Dependency Graph

```
v1.7.0 ──▶ Wikilink autocomplete (đã có) ──┐
                                            │
                    ┌───────────────────────┤
                    ▼                       ▼
v1.8.0:     S-GV1 (Rust: build_link_graph)  │
                │                           │
                ├──▶ S-GV2 (graph.ts store) │
                │       │                   │
                │       └──▶ S-GV3 (GraphPanel D3.js)
                │               │
                │               └──▶ S-GV4 (Sidebar tab)
                │
                ├──▶ S-BL1 (Rust: find_backlinks)
                │       │
                │       └──▶ S-BL2 (BacklinksPanel)
                │               │
                │               └──▶ S-BL3 (PreviewPane integration)
                │
                └──▶ S-TG1 (Rust: extract_tags) ── độc lập
                        │
                        └──▶ S-TG2 (TagsPanel)
                                │
                                └──▶ S-TG3 (File tree filter)

S-FM1 (frontmatter utils) ── độc lập
    │
    ├──▶ S-FM2 (properties store)
    │       │
    │       └──▶ S-FM3 (PropertiesPanel)
    │               │
    │               └──▶ S-FM4 (Sidebar tab + Daily Notes)

S-TP1 (Rust: create_md_file + template) ── độc lập
    │
    └──▶ S-TP2 (TemplateChooser)
            │
            └──▶ S-TP3 (New File flow + Settings)

S-CL1 (Callout renderer) ── độc lập
    │
    └──▶ S-CL2 (Toolbar button) ── độc lập

S-EX1 (Export PDF) ── hoàn toàn độc lập

Research ──────▶ Page History prototype (không ship v1.8.0)
```

### Complexity & Impact Matrix

| Story | Feature | Complexity | Rust? | Priority |
|-------|---------|------------|-------|----------|
| S-GV1 | Rust: `build_link_graph` | 🔴 Trung bình–Cao | ✅ | 🔴 Phải có |
| S-GV2 | Store: `graph.ts` | 🟢 Thấp | ❌ | 🔴 Phải có |
| S-GV3 | `GraphPanel.vue` (D3.js) | 🔴 Cao | ❌ | 🔴 Phải có |
| S-GV4 | Sidebar Graph tab | 🟢 Thấp | ❌ | 🔴 Phải có |
| S-BL1 | Rust: `find_backlinks` | 🟢 Thấp | ✅ | 🔴 Phải có |
| S-BL2 | `BacklinksPanel.vue` | 🟢 Thấp | ❌ | 🔴 Phải có |
| S-BL3 | Backlinks UI integration | 🟢 Thấp | ❌ | 🔴 Phải có |
| S-FM1 | Frontmatter parser utils | 🟡 Thấp–TB | ❌ | 🟠 Cao |
| S-FM2 | Store: `properties.ts` | 🟡 Trung bình | ❌ | 🟠 Cao |
| S-FM3 | `PropertiesPanel.vue` | 🟡 Trung bình–Cao | ❌ | 🟡 Trung bình |
| S-FM4 | Properties integration | 🟢 Thấp | ❌ | 🟡 Trung bình |
| S-TP1 | Rust: template in `create_md_file` | 🟢 Thấp | ✅ | 🟡 Trung bình |
| S-TP2 | `TemplateChooser.vue` | 🟢 Thấp | ❌ | 🟡 Trung bình |
| S-TP3 | Template flow + Settings | 🟡 Trung bình | ❌ | 🟡 Trung bình |
| S-CL1 | Callout renderer (PreviewPane) | 🟢 Thấp | ❌ | 🟢 Thấp |
| S-CL2 | Callout toolbar button | 🟢 Thấp | ❌ | 🟢 Thấp |
| S-TG1 | Rust: `extract_tags` | 🟢 Thấp | ✅ | 🟢 Thấp |
| S-TG2 | `TagsPanel.vue` | 🟢 Thấp | ❌ | 🟢 Thấp |
| S-TG3 | Tags panel + file tree filter | 🟡 Trung bình | ❌ | 🟢 Thấp |
| S-EX1 | Export PDF | 🟢 Thấp–TB | ❌ | 🟢 Thấp |

### New Files Expected

```
# Graph View
src/components/GraphPanel.vue              (S-GV3) — D3.js force graph
src/stores/graph.ts                        (S-GV2) — Link graph data store

# Backlinks
src/components/BacklinksPanel.vue          (S-BL2) — Inbound links panel

# Frontmatter / Properties
src/components/PropertiesPanel.vue         (S-FM3) — YAML frontmatter editor
src/stores/properties.ts                   (S-FM2) — Frontmatter state + sync
src/utils/frontmatter.ts                   (S-FM1) — YAML parse/serialize utils

# Templates
src/components/TemplateChooser.vue         (S-TP2) — Template picker dropdown

# Tags
src/components/TagsPanel.vue               (S-TG2) — Tag cloud/list

# Callouts (inline in PreviewPane, no new files needed)
# Export PDF (inline in PreviewPane, no new files needed)
```

### Modified Files Expected

```
src-tauri/src/lib.rs                       (S-GV1, S-BL1, S-TG1, S-TP1) — 4 new commands
src-tauri/capabilities/default.json        (S-GV1+) — update permissions

src/components/Sidebar.vue                 (S-GV4, S-FM4, S-TG3) — new sidebar tabs
src/components/ExplorerPanel.vue           (S-GV4, S-FM4, S-TG3, S-TP3) — activity row + template flow
src/components/PreviewPane.vue             (S-BL3, S-CL1, S-EX1) — backlinks section + callout renderer + export
src/components/SourceEditor.vue            (S-CL2) — callout toolbar button
src/components/EditorArea.vue              (S-FM4) — properties toggle integration
src/components/SettingsModal.vue           (S-TP3) — templates folder setting

src/stores/ui.ts                           (S-GV4, S-FM4, S-TG3) — sidebarView states
src/stores/workspace.ts                    (S-TP3, S-FM4) — template + daily note frontmatter

src/styles/preview.scss                    (S-CL1) — callout styles
src/styles/print.scss                      (S-EX1) — PDF export print styles

src/i18n/index.ts                          (all) — new i18n keys
```

### New i18n Keys

```
# Explorer activity bar
explorer.graph
explorer.properties
explorer.tags

# Graph
graph.empty
graph.loading
graph.search
graph.localGraph
graph.fullGraph

# Backlinks
backlinks.title
backlinks.empty
backlinks.linkedFrom
backlinks.wikilink
backlinks.mdLink

# Properties
properties.title
properties.add
properties.empty
properties.editKey
properties.delete
properties.typeText
properties.typeDate
properties.typeTags
properties.typeNumber
properties.typeBoolean
properties.typeList

# Templates
settings.templateFolder
settings.templateFolderDesc
ctx.chooseTemplate
template.empty

# Callouts
toolbar.callout
callout.note
callout.info
callout.warning
callout.tip
callout.danger
callout.success
callout.example
callout.quote

# Tags
tags.title
tags.noTags
tags.filteredBy
tags.clearFilter
tags.searchTags

# Export
preview.exportPdf
```

### Thứ tự triển khai đề xuất (3 tuần)

**Tuần 1 — Foundation + Headliner:**
1. S-GV1 — Rust `build_link_graph` command (shared data layer)
2. S-BL1 — Rust `find_backlinks` command (dùng chung cache)
3. S-GV2 — `graph.ts` store
4. S-GV3 — `GraphPanel.vue` (D3.js — item phức tạp nhất)
5. S-GV4 — Sidebar Graph tab

**Tuần 2 — Backlinks + Quick Wins:**
6. S-BL2 — `BacklinksPanel.vue`
7. S-BL3 — Tích hợp vào PreviewPane
8. S-CL1 — Callout renderer trong PreviewPane
9. S-CL2 — Callout toolbar button
10. S-TG1 — Rust `extract_tags`
11. S-TG2 — `TagsPanel.vue`

**Tuần 3 — Properties + Templates + Polish:**
12. S-FM1 — Frontmatter utility functions
13. S-FM2 — `properties.ts` store
14. S-FM3 — `PropertiesPanel.vue`
15. S-FM4 — Properties sidebar tab + Daily Notes integration
16. S-TP1 — Rust template extension
17. S-TP2 — `TemplateChooser.vue`
18. S-TP3 — Template flow + Settings
19. S-TG3 — Tags ↔ file tree filter
20. S-EX1 — Export PDF button + print styles

**Ongoing:** Page History research — không block release.

---

## 10. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|------------|
| D3.js learning curve + force simulation tuning | 🟡 TB | 🔴 High | Spike 2 ngày trước Sprint để prototype force layout |
| Link graph scan performance với workspace >1000 files | 🟢 Thấp | 🟡 TB | Rust multi-threaded (rayon), cache, incremental update |
| YAML frontmatter sync conflict (editor ↔ form) | 🟡 TB | 🟡 TB | Debounce 500ms, CM6 transaction-based, lock flag khi form editing |
| Template substitution collision với nội dung thật | 🟢 Thấp | 🟢 Thấp | Chỉ substitute khi tạo file mới, không ảnh hưởng file có sẵn |
| Backlinks/Callout regex false positives | 🟢 Thấp | 🟢 Thấp | Regex kỹ + test cases cho edge cases |
| D3.js bundle ảnh hưởng cold start | 🟢 Thấp | 🟡 TB | Dynamic import, chỉ load khi mở Graph tab lần đầu |

---

## 11. Success Metrics

| Metric | Target |
|--------|--------|
| Graph View render time với 100 nodes | <1s sau khi data loaded |
| Link graph scan với 500 files | <500ms |
| Backlinks query (from cache) | <10ms |
| Frontmatter sync latency | <500ms debounce |
| Cold start bundle size increase | <50KB (D3 dynamic import) |
| New Rust commands | 4 (`build_link_graph`, `find_backlinks`, `extract_tags`, mở rộng `create_md_file`) |
| New Vue components | 5 (`GraphPanel`, `BacklinksPanel`, `PropertiesPanel`, `TemplateChooser`, `TagsPanel`) |
| New Pinia stores | 2 (`graph.ts`, `properties.ts`) |
| New i18n keys | ~35 |
