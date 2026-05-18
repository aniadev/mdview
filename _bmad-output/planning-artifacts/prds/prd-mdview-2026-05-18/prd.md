---
title: "mdview — Markdown Workspace Editor"
status: final
version: 1.0.0
created: 2026-05-18
updated: 2026-05-18
---

# PRD: mdview

## 0. Mục đích tài liệu

PRD này dành cho tác giả (developer), contributor tương lai, và downstream workflow (UX, architecture, epics). Tài liệu định nghĩa yêu cầu chức năng và phi chức năng cho mdview v1 — desktop app xem và edit markdown trong project folder, build bằng Tauri, phát hành công khai trên Mac và Windows. Vocabulary trong §3 Glossary là chuẩn duy nhất — không dùng synonym ở nơi khác.

Nguồn đầu vào: `briefs/brief-mdview-2026-05-18/brief.md` (status: final).

---

## 1. Vision

Developer edit `.md` trong project folder không có tool vừa vặn: VSCode quá đa năng (không có workspace mode tập trung vào markdown, preview cần extension), Obsidian vault-centric và nặng, Typora không quản lý folder. Kết quả là mở nhiều app, mất context, hoặc chấp nhận UX không phù hợp.

mdview là tool chuyên biệt: mở folder, thấy file `.md`, edit và preview song song — ngay lập tức, không cần config, không cần plugin. File tree hiển thị toàn bộ cấu trúc dự án nhưng dim các folder không chứa `.md`, tạo focus tự nhiên mà không ẩn context. Giao diện quen thuộc với bất kỳ ai đã dùng VSCode: sidebar, tabs, dark theme.

Triết lý thiết kế: **zero-config, zero-plugin, one job well done.** mdview không mở rộng thành platform. Mỗi feature thêm vào phải justify sự hiện diện so với sự đơn giản bị mất đi.

Build bằng Tauri — bundle nhỏ (~10MB), khởi động nhanh, native trên cả Mac và Windows. Không Electron, không overhead.

---

## 2. Target User

### 2.1 Primary Persona

**Developer quản lý documentation trong project folder.** Dùng VSCode hằng ngày, quản lý README, CHANGELOG, docs/ trong cùng repo code. Khi cần focus vào markdown, VSCode quá lộn xộn nhưng không muốn switch sang app khác nặng hơn hoặc phải setup thêm.

### 2.2 Jobs To Be Done

- Mở project folder và thấy ngay file `.md` nào tồn tại, không bị lẫn lộn với các file khác
- Edit markdown và thấy rendered output ngay lập tức, không toggle qua lại
- Mở nhiều file `.md` cùng lúc trong tabs mà không mất context
- Tìm file theo tên nhanh qua keyboard shortcut

### 2.3 Key User Journeys

**UJ-1. Developer mở project folder và edit README.**
- **Persona + context:** Developer vừa clone repo, muốn cập nhật README trước khi push.
- **Entry state:** App đang mở, chưa có workspace.
- **Path:** (1) Click "Add Folder" → chọn folder repo qua OS file picker. (2) Sidebar hiển thị full file tree — folders không có `.md` mờ đi, `README.md` rõ nét. (3) Click `README.md` → mở trong tab, split-pane hiện ra: source editor trái, preview phải. (4) Gõ markdown → preview cập nhật real-time. (5) Cmd+S để lưu.
- **Climax:** Thấy rendered output ngay khi gõ — không cần reload, không cần toggle.
- **Resolution:** File đã lưu, tab vẫn mở, có thể mở file khác.
- **Edge case:** Folder không chứa file `.md` nào → sidebar hiển thị cấu trúc đầy đủ nhưng tất cả đều dim, thông báo nhỏ "No .md files found".

**UJ-2. Writer tìm và mở file bằng Command Palette.**
- **Persona + context:** Technical writer có workspace với 20+ file `.md` trong nhiều subfolder.
- **Entry state:** App đang mở, workspace đã add, đang edit một file.
- **Path:** (1) Nhấn Cmd+P (Mac) / Ctrl+P (Windows). (2) Overlay Command Palette xuất hiện. (3) Gõ tên file → danh sách filter real-time. (4) Nhấn Enter → file mở trong tab mới.
- **Climax:** Tìm và mở file trong < 3 giây không cần dùng chuột.
- **Resolution:** Tab mới active, có thể edit ngay.

### 2.4 Non-Users (v1)

- Người dùng cần export PDF/HTML — không có trong v1
- Người dùng cần Git workflow tích hợp — không có trong v1
- Người dùng cần knowledge graph hoặc backlinks — ngoài scope của mdview

---

## 3. Glossary

- **Workspace** — Một local folder được add vào mdview làm root của file tree. [ASSUMPTION: v1 hỗ trợ đúng một Workspace tại một thời điểm.]
- **File Tree** — Sidebar bên trái hiển thị toàn bộ cấu trúc folder/file của Workspace.
- **Dim** — Trạng thái visual của folder trong File Tree khi folder đó không chứa file `.md` nào (trực tiếp hoặc trong subfolder) — opacity giảm so với mặc định.
- **Tab** — Một file `.md` đang mở trong editor, hiển thị trên thanh tab phía trên Editor Area.
- **Editor Area** — Vùng chính bên phải sidebar, chứa Tab bar và Split-pane.
- **Split-pane** — Layout của Editor Area: Source Editor bên trái, Preview bên phải, song song.
- **Source Editor** — Pane trái trong Split-pane — raw markdown text, có syntax highlighting.
- **Preview** — Pane phải trong Split-pane — markdown đã render thành HTML, đồng bộ scroll với Source Editor.
- **Command Palette** — Overlay tìm kiếm file theo tên, kích hoạt bằng Cmd+P (Mac) / Ctrl+P (Windows).
- **GFM** — GitHub Flavored Markdown — spec markdown được dùng để render trong Preview.
- **Editor Toolbar** — Thanh nút phía trên Source Editor cho phép insert/wrap markdown syntax cho selection hoặc cursor hiện tại.
- **Math Block** — Đoạn LaTeX render bằng KaTeX. Inline: `$…$`. Block: `$$…$$`.
- **Mermaid Block** — Fenced code block với info-string `mermaid`, render thành SVG diagram.
- **Theme** — Chế độ màu của app: `dark` (mặc định) hoặc `light`. Toggle qua nút trên Sidebar header, persist giữa sessions.
- **Browser Export** — Snapshot HTML standalone của Preview hiện tại, ghi vào temp folder của OS rồi mở bằng default browser.

---

## 4. Features

FRs được đánh số toàn cục FR-1 đến FR-22, không đổi dù feature được tổ chức lại. Downstream artifacts (epics, stories) reference theo FR-N. FR-1..FR-17 = MVP shipped 2026-05-18. FR-18..FR-22 = v1.0 additions cùng ngày.

### 4.1 Workspace Management

**Mô tả:** User add một local folder làm Workspace. File Tree load và hiển thị ngay. Workspace được nhớ giữa các session. User có thể remove Workspace hiện tại để add folder khác. Realizes UJ-1.

**Functional Requirements:**

#### FR-1: Add Workspace

User có thể add một local folder làm Workspace qua OS native file picker.

**Consequences:**
- File Tree render ngay sau khi folder được chọn, trong < 1 giây với folder ≤ 1000 files.
- Workspace path được lưu persistent — relaunch app vẫn mở đúng Workspace.

**Out of Scope:** Multi-root workspace (nhiều folder cùng lúc) — v1 chỉ hỗ trợ một Workspace.

#### FR-2: Remove Workspace

User có thể xóa Workspace hiện tại (không xóa folder trên disk).

**Consequences:**
- File Tree trống sau khi remove.
- App không crash hay báo lỗi khi Workspace bị remove.

#### FR-3: Workspace Persistence

App nhớ Workspace đã add giữa các lần mở.

**Consequences:**
- Relaunch app → Workspace cũ tự động load lại.
- Nếu folder đã bị xóa khỏi disk: hiển thị thông báo lỗi rõ ràng, không crash.

---

### 4.2 File Tree Explorer

**Mô tả:** Sidebar trái hiển thị toàn bộ cấu trúc folder của Workspace. Folder chứa `.md` (trực tiếp hoặc trong subfolder) hiển thị bình thường. Folder không chứa `.md` nào được Dim. Click file `.md` để mở trong Tab. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-4: Hiển thị cấu trúc folder đầy đủ

File Tree hiển thị toàn bộ folder và file trong Workspace, có thể expand/collapse từng folder.

**Consequences:**
- Tất cả folder và file đều hiển thị, không filter ẩn.
- Folder mặc định collapsed; user click để expand.

#### FR-5: Dim folder không có .md

Folder không chứa file `.md` nào (ở bất kỳ depth nào) được hiển thị với opacity giảm.

**Consequences:**
- Opacity của Dim folder đủ thấp để phân biệt rõ với folder bình thường. Giá trị cụ thể do implementation quyết định.
- Folder chứa ít nhất một `.md` ở bất kỳ subfolder nào = không Dim.

#### FR-6: Mở file .md từ File Tree

Click vào file `.md` trong File Tree → file mở trong Tab mới (hoặc focus vào Tab đang mở nếu file đã open).

**Consequences:**
- Non-`.md` files trong File Tree hiển thị nhưng không thể click để mở trong editor. [ASSUMPTION: click vào non-md file không làm gì.]

---

### 4.3 Tab Editor

**Mô tả:** Editor Area hỗ trợ nhiều Tab mở đồng thời. Mỗi Tab là một file `.md`. User có thể chuyển giữa Tabs và đóng Tab. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-7: Mở nhiều Tab

Nhiều file `.md` có thể mở đồng thời trong Tab bar.

**Consequences:**
- Mỗi Tab hiển thị tên file (basename, không kèm path đầy đủ).
- Tab active được highlight rõ ràng.
- Số lượng Tab tối đa: không giới hạn cứng trong v1. [ASSUMPTION]

#### FR-8: Chuyển Tab

Click vào Tab → Editor Area chuyển sang nội dung file đó.

#### FR-9: Đóng Tab

User có thể đóng Tab bằng nút X trên Tab hoặc Cmd+W (Mac) / Ctrl+W (Windows).

**Consequences:**
- Đóng Tab không xóa file trên disk.
- Nếu file có thay đổi chưa lưu khi đóng: hiển thị confirm dialog. [ASSUMPTION: có unsaved indicator.]

#### FR-10: Manual Save

File lưu khi user nhấn Cmd+S (Mac) / Ctrl+S (Windows).

**Consequences:**
- File không tự động lưu — user phải chủ động save.
- Tab hiển thị unsaved indicator (dấu chấm hoặc ký tự đặc biệt trên tên file) khi có thay đổi chưa lưu.
- Đóng Tab có thay đổi chưa lưu → hiển thị confirm dialog.

---

### 4.4 Split-Pane Editor

**Mô tả:** Mỗi Tab mở trong Split-pane layout: Source Editor (trái) và Preview (phải). Preview render GFM real-time khi user gõ. Scroll hai pane đồng bộ. Realizes UJ-1.

**Functional Requirements:**

#### FR-11: Source Editor

Pane trái hiển thị raw markdown với syntax highlighting cơ bản.

**Consequences:**
- Highlight: headings, bold, italic, inline code, code blocks, links.
- Font monospace. Line numbers hiển thị. [ASSUMPTION]

#### FR-12: Preview render GFM real-time

Pane phải render markdown theo GFM spec, cập nhật real-time khi Source Editor thay đổi.

**Consequences:**
- Render: headings, lists, tables, code blocks (syntax highlight), blockquotes, links, images (từ relative path hoặc URL), strikethrough.
- Debounce render: 150ms sau lần gõ cuối để tránh flicker. [ASSUMPTION]
- File ≤ 500KB: delay render < 200ms sau debounce 150ms (same threshold as NFR-3).

#### FR-13: Scroll sync

Scroll trong Source Editor → Preview tự động scroll đến vị trí tương ứng (proportional).

**Consequences:**
- Scroll sync hoạt động theo tỷ lệ vị trí (percentage scroll), không theo line number. [ASSUMPTION]

#### FR-14: Điều chỉnh tỷ lệ pane

User có thể kéo divider giữa Source Editor và Preview để thay đổi tỷ lệ chiều rộng.

**Consequences:**
- Tỷ lệ mặc định: 50/50.
- Tỷ lệ được nhớ per-session. [ASSUMPTION: không persist giữa sessions.]

---

### 4.5 Command Palette

**Mô tả:** Overlay tìm kiếm file theo tên trong Workspace, kích hoạt bằng keyboard shortcut. Realizes UJ-2.

**Functional Requirements:**

#### FR-15: Kích hoạt Command Palette

Cmd+P (Mac) / Ctrl+P (Windows) mở overlay Command Palette từ bất kỳ trạng thái nào của app.

**Consequences:**
- Overlay xuất hiện trên Editor Area, không che sidebar.
- Nhấn Escape để đóng.

#### FR-16: Tìm file theo tên

User gõ vào Command Palette → danh sách file `.md` trong Workspace filter theo fuzzy match với tên file.

**Consequences:**
- Search chỉ trên filename (basename), không full path, không full-text content.
- Kết quả cập nhật real-time khi user gõ.
- Tối đa 20 kết quả hiển thị cùng lúc.

#### FR-17: Mở file từ Command Palette

User chọn kết quả bằng arrow keys + Enter, hoặc click → file mở trong Tab.

**Consequences:**
- Nếu file đã mở trong Tab: focus Tab đó, không mở duplicate.
- Command Palette đóng sau khi file được mở.

---

### 4.6 Extended Markdown (v1.0)

**Mô tả:** Preview hỗ trợ math (KaTeX) và Mermaid diagram bên cạnh GFM baseline. Overrides assumption §8/OQ-3.

**Functional Requirements:**

#### FR-18: Math rendering (KaTeX)

Preview render inline math `$E = mc^2$` và display math `$$\int_0^\infty e^{-x}\,dx$$` bằng KaTeX.

**Consequences:**
- CSS KaTeX được bundle inline trong app; không yêu cầu network.
- Syntax error trong block math hiển thị red error inline thay vì crash render.
- Browser Export (FR-21) link KaTeX CSS qua CDN để giữ HTML standalone nhỏ.

#### FR-19: Mermaid diagram rendering

Fenced code block với info-string `mermaid` render thành SVG diagram.

**Consequences:**
- Mermaid runtime lazy-load (chỉ load lần đầu user mở file có Mermaid block) — không cost cho file không dùng.
- Mermaid theme đồng bộ với app Theme (FR-22): `dark` → mermaid theme `dark`, `light` → `default`.
- Render lỗi syntax hiển thị thông báo lỗi của Mermaid trong vị trí block; không break các block khác.

---

### 4.7 Editor Toolbar (v1.0)

**Mô tả:** Thanh nút phía trên Source Editor cho phép thao tác markdown nhanh. Áp dụng cho selection hoặc cursor hiện tại. Mỗi action undoable qua Cmd/Ctrl+Z.

**Functional Requirements:**

#### FR-20: Markdown Toolbar Actions

Toolbar cung cấp ít nhất các action: **Bold**, **Italic**, **Heading** (cycle H1→H2→H3→none), **Underline**, **Strikethrough**, **Ordered list**, **Unordered list**, **Checklist**, **Quote**, **Code block**, **Table**, **Link**, **Image**.

**Consequences:**
- Action wrap (Bold/Italic/Strike/Underline/Link/Image) bọc selection hoặc insert placeholder nếu không có selection.
- Action line-prefix (Quote/Lists/Checklist) apply trên toàn bộ dòng được select; multi-line OK.
- Action block (Code block/Table) chèn template tại cursor.
- Bold = Cmd/Ctrl+B, Italic = Cmd/Ctrl+I bằng phím tắt.
- Tất cả CM6 transactions → fit chung undo stack với typing.

---

### 4.8 Browser Export (v1.0)

**Mô tả:** Export snapshot Preview hiện tại thành HTML standalone, mở bằng default browser của OS. Cho phép share/print/PDF qua browser.

**Functional Requirements:**

#### FR-21: Open Preview in Browser

Toolbar có nút "Open in browser" → snapshot Preview hiện tại được ghi vào OS temp folder rồi mở bằng default browser.

**Consequences:**
- HTML output bao gồm: rendered markdown body, KaTeX CSS (CDN link), syntax highlight CSS (inline), Mermaid SVG (inline, đã render).
- File temp đặt tên `mdview-<basename>-<timestamp>.html` để tránh collision.
- Hoạt động cả khi file chưa save (snapshot từ buffer hiện tại).
- Theme của HTML output match Theme hiện tại của app.

---

### 4.9 Theme (v1.0)

**Mô tả:** App hỗ trợ dark theme (mặc định) và light theme. User toggle qua nút trên Sidebar header. Theme persist giữa sessions.

**Functional Requirements:**

#### FR-22: Theme Switch

Sidebar header có button toggle giữa `dark` và `light` theme. Lựa chọn persist qua tauri-plugin-store và restore khi launch.

**Consequences:**
- Toggle áp dụng đồng bộ cho: app chrome (sidebar, tab bar, editor area), Source Editor (CodeMirror theme rebuild), Preview (markdown body + syntax highlight CSS swap), Mermaid diagrams (re-render với theme tương ứng).
- Lần đầu chạy: default `dark`.
- Browser Export (FR-21) tạo HTML với theme hiện tại.
- Custom theme (user-defined colors) vẫn ngoài scope — chỉ 2 preset.

---

## 5. Non-Goals (Explicit)

- Export file `.md` sang PDF (workaround v1.0: dùng Browser Export FR-21 → print-to-PDF của browser)
- Git integration (diff, commit, blame)
- Custom theme (user-defined colors); v1.0 chỉ có 2 preset dark/light (FR-22)
- Full-text search trong nội dung file
- Image paste / embed từ clipboard
- Collaborative editing
- Vault / knowledge graph / backlinks
- Plugin system
- Mobile hoặc web app
- Auto-update (manual download mỗi release)

---

## 6. Release Scope (v1.0)

### 6.1 In Scope

- Add / remove Workspace (single folder) — FR-1..3
- File Tree với Dim cho folder không có `.md` — FR-4..6
- Tab-based editor (nhiều file đồng thời) — FR-7..10
- Split-pane: Source Editor + Preview (GFM) — FR-11..14
- Manual save (Cmd+S / Ctrl+S) với unsaved indicator trên tab — FR-10
- Command Palette (Cmd+P / Ctrl+P) — tìm file theo tên — FR-15..17
- Math (KaTeX) + Mermaid diagram trong Preview — FR-18, FR-19
- Editor Toolbar (Bold/Italic/Heading/Underline/Strike/lists/checklist/quote/code/table/link/image) — FR-20
- Open Preview in Browser — FR-21
- Theme switch dark ↔ light, persist — FR-22
- Cross-platform: Mac (Apple Silicon + Intel) + Windows 10/11

### 6.2 Out of Scope cho v1.0

- Native Export PDF (workaround: Browser Export → print-to-PDF)
- Git integration — deferred v2+
- Custom theme (user-defined colors) — deferred v2 `[NOTE FOR PM: high-request feature nếu có user feedback]`
- Full-text search — deferred v2
- Image paste/embed — deferred v2
- Auto-update — deferred v2

---

## 7. Non-Functional Requirements

### Performance

- **NFR-1:** App khởi động (cold start) < 2 giây trên hardware tối thiểu (4GB RAM, 4-core CPU).
- **NFR-2:** File Tree load folder ≤ 1000 files trong < 1 giây.
- **NFR-3:** Preview render file ≤ 500KB với delay < 200ms sau debounce.
- **NFR-4:** Memory usage < 200MB trong điều kiện bình thường (1 Workspace, ≤ 5 Tabs mở). [ASSUMPTION]

### Platform & Distribution

- **NFR-5:** Bundle size < 20MB cho installer trên cả Mac và Windows.
- **NFR-6:** Chạy ổn định trên macOS 12+ (Apple Silicon + Intel) và Windows 10/11.
- **NFR-7:** Không yêu cầu runtime dependency (Node.js, Python...) — Tauri standalone. [ASSUMPTION: WebView system bundled không tính.]

### UX & Simplicity

- **NFR-8:** Zero-config — app hoạt động ngay sau install, không có setup wizard, không yêu cầu account.
- **NFR-9:** Giao diện tuân theo VSCode spatial model: sidebar trái (File Tree), tab bar trên, editor area chiếm phần còn lại. Người dùng VSCode không cần học lại.

---

## 8. Success Metrics


**Primary**
- **SM-1:** Cold-start time (first launch sau reboot, Workspace đã có sẵn) < 2 giây đến khi File Tree render xong — validates NFR-1, NFR-2. Pass: measured on 4GB RAM / 4-core CPU hardware.
- **SM-2:** Preview render delay ≤ 200ms sau debounce khi edit file ≤ 500KB — validates NFR-3, FR-12. Pass: no visible lag reported in manual testing on target hardware.
- **SM-3:** Installer file size < 20MB trên cả Mac và Windows — validates NFR-5. Pass: measured artifact size trước khi release.

**Adoption signals** *(không đo bằng metric cứng — side project)*
- GitHub stars và download count tăng organic sau release.
- Issue reports từ người dùng ngoài tác giả (chứng minh real usage).

**Counter-metrics (không optimize)**
- **SM-C1:** Số lượng features — không thêm feature ngoài scope v1 để chase stars. Đây là intentional minimalism.

---

## 9. Open Questions

1. **Single vs multi-workspace:** v1 assume single Workspace. Nếu user muốn switch giữa nhiều projects, workflow hiện tại là remove + add. Có cần "Recent Workspaces" list không? [ASSUMPTION: không có trong v1.0]
2. **Non-.md file interaction:** ~~Đã quyết định~~ — FR-6 xác nhận click vào non-`.md` file không trigger action. Closed.
3. **Markdown spec edge cases (math/Mermaid):** ~~Đã quyết định~~ — FR-18, FR-19 added cho v1.0. Closed.
4. **Tab restore on relaunch:** App có nhớ và restore tabs đang mở từ session trước không? [ASSUMPTION: không — chỉ restore Workspace + Theme, không restore tabs]
5. **Research TODO — Nota:** Training-data research (Aug 2025) phát hiện Nota (Tauri-based, ~8MB, folder-based) có thể là direct competitor. Cần verify: (a) Nota có tính năng "dim non-.md folders" không? (b) Nota có split-pane không? Kết quả ảnh hưởng đến differentiator claims trong marketing copy.
6. **PDF export native:** v1.0 dùng Browser Export → print-to-PDF của browser. Có cần native PDF export (skip browser) ở v2 không? Quyết định theo user feedback sau release.
7. **Custom theme:** v1.0 chỉ 2 preset. Có nên expose CSS var override hoặc theme JSON ở v2 không? Đánh giá theo demand.

---

## 10. Assumptions Index

- **§4.1/FR-1** — v1 hỗ trợ một Workspace duy nhất tại một thời điểm.
- **§4.2/FR-5** — Dim opacity: giá trị cụ thể do implementation quyết định. Confirmed 2026-05-18.
- **§4.2/FR-6** — Click non-`.md` file không trigger action.
- **§4.3/FR-7** — Không giới hạn cứng số Tab.
- **§4.3/FR-9** — Có unsaved indicator và confirm dialog khi đóng tab có thay đổi chưa lưu.
- **§4.3/FR-10** — Manual save (Cmd+S). Không auto-save. Confirmed 2026-05-18.
- **§4.4/FR-12** — Debounce render Preview = 150ms.
- **§4.4/FR-13** — Scroll sync theo percentage, không theo line number.
- **§4.4/FR-14** — Pane ratio không persist giữa sessions.
- **§7/NFR-4** — Memory < 200MB với ≤ 5 Tabs mở — cần validate khi implement.
- **§8/OQ-1** — Không có "Recent Workspaces" trong v1.0.
- **§8/OQ-3** — ~~Không hỗ trợ math / Mermaid~~ — overridden, shipped FR-18/FR-19 trong v1.0.
- **§8/OQ-4** — App restore Workspace + Theme; không restore tabs từ session trước.
- **§4.6/FR-18** — KaTeX CSS bundle inline cho app; CDN cho Browser Export.
- **§4.6/FR-19** — Mermaid runtime lazy-load lần đầu, share theme với app Theme.
- **§4.7/FR-20** — Toolbar actions sit trong CM6 undo stack.
- **§4.8/FR-21** — Snapshot tại temp dir, không cleanup tự động (OS dọn theo policy).
- **§4.9/FR-22** — Theme persist qua tauri-plugin-store cùng `mdview-settings.json` (chung file với workspace path).
