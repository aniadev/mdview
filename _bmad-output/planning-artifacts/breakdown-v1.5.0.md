---
title: "mdview v1.5.0 — Feature Breakdown"
version: 1.5.0
created: 2026-05-20
status: planning
---

# v1.5.0 Feature Breakdown

Ba tính năng mới + một bug fix. Trọng tâm: i18n tiếng Việt, copy-paste file trên explorer, và tour guide cho người mới.

---

## 0. FIX: Export PDF lỗi

### 0.1 Phân tích gốc rễ

`printPdf()` hiện tại gọi `window.print()` trực tiếp trên webview. CSS `@media print` trong `main.css` ẩn chrome UI (sidebar, tab bar, toolbar, bottom panel). **Vấn đề:**

1. **`window.print()` mở native dialog** — webview Tauri không có print dialog native trên một số nền tảng (đặc biệt Linux/Wayland). User không thấy dialog nào hoặc dialog không hoạt động.
2. **CSS print không đầy đủ** — `@media print` chỉ ẩn chrome, không tối ưu layout cho PDF (page break, margin, font size).
3. **Mermaid diagram** — ở chế độ dark theme, Mermaid render với màu tối. In ra giấy trắng → không nhìn thấy.
4. **Hình ảnh** — `convertFileSrc()` không hoạt động trong context print/webview.

### 0.2 Giải pháp: Build standalone HTML → mở browser → print

Thay vì `window.print()` trên webview, tạo HTML standalone giống như flow "Open Preview in Browser", nhưng với CSS print chuyên nghiệp và tự động mở print dialog của system browser.

**Flow:**
1. User click nút Print
2. Gọi `buildStandaloneHtml(title)` (đã có sẵn)
3. Thêm `@media print` stylesheet chất lượng vào HTML (page margin, font size 11pt, page-break tránh cắt code block)
4. Ép theme sáng cho bản in (force light theme trong print stylesheet)
5. Ghi HTML temp → mở bằng system browser
6. Inject `<script>window.onload = () => window.print()</script>` vào HTML để browser tự mở print dialog

### 0.3 Stories

#### S-B1 — PreviewPane: nâng cấp `buildStandaloneHtml` với print stylesheet và force-light theme

**Goal:** Hàm `buildStandaloneHtml()` bổ sung `<style media="print">` và ép light theme cho Mermaid.

**Scope:**
- `PreviewPane.vue`: trong `buildStandaloneHtml()`:
  - Thêm `<style media="print">` block vào `<head>`:
    ```css
    @media print {
      @page { margin: 2cm; size: A4; }
      body {
        font-size: 11pt;
        line-height: 1.6;
        color: #000;
        background: #fff;
      }
      .markdown-body { max-width: 100%; padding: 0; }
      pre, code {
        background: #f5f5f5 !important;
        border: 1px solid #ddd;
        page-break-inside: avoid;
      }
      h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
      img { max-width: 100%; page-break-inside: avoid; }
      table { page-break-inside: avoid; }
      .mermaid svg { background: #fff !important; }
    }
    ```
  - Ép data-theme="light" trên `<html>` bất kể `previewTheme` hiện tại
  - Inject `<script>`: `window.addEventListener('load', () => { setTimeout(() => window.print(), 500); });`
  - Giữ nguyên `BASE_EXPORT_CSS` cho màn hình — print CSS là layer riêng
- `defineExpose` vẫn export `buildStandaloneHtml` như cũ

**Complexity:** Thấp

---

#### S-B2 — EditorArea: cập nhật flow "Print" dùng standalone HTML

**Goal:** Nút Print hiện tại (`window.print()`) chuyển sang flow standalone HTML + system browser.

**Scope:**
- `PreviewPane.vue`: thêm hàm `exportForPrint(title)`:
  ```ts
  async function exportForPrint(title: string) {
    const html = buildStandaloneHtml(title);
    const path = await invoke("write_temp_html", { html, baseName: title });
    await openPath(path);
  }
  ```
- `defineExpose` thêm `exportForPrint`
- `EditorArea.vue`: gọi `previewRef.value.exportForPrint(tab.value.name)` thay vì `printPdf()`
- Xóa `printPdf()` và `window.print()` trong `PreviewPane.vue`
- Nút printer giữ nguyên icon `lucide:printer`

**Dependency:** S-B1

**Complexity:** Thấp

---

### 0.4 Implementation Order

```
S-B1 (nâng cấp buildStandaloneHtml) → S-B2 (đổi flow print)
```

---

## 1. Copy-Paste File/Folder trên Sidebar Explorer

### 1.1 Phân tích

Hiện tại context menu chỉ có New File, New Folder, Rename, Delete. Không có cách copy một file `.md` hoặc folder sang thư mục khác trong cùng workspace (hoặc khác root).

**Yêu cầu:**
- Copy/Cut file hoặc folder → lưu vào clipboard (source path + operation type)
- Paste vào thư mục đích → copy hoặc move file/folder
- Hỗ trợ copy/paste folder đệ quy (copy toàn bộ nội dung)
- Hỗ trợ cross-root paste (giữa các workspace root khác nhau)
- Xử lý trùng tên: tự động thêm `-copy` suffix hoặc số đếm
- Cut (move) hoạt động như rename: tab đang mở tự động cập nhật path mới

**Rust commands cần thêm:**
- `copy_path(source, dest_dir)` — copy file hoặc folder đệ quy đến `dest_dir`
- Trả về path mới (đã resolve trùng tên)

### 1.2 Stories

#### S1 — Rust: `copy_path` command

**Goal:** Thêm Tauri command `copy_path` sao chép file hoặc folder.

**Scope:**
- `src-tauri/src/lib.rs`:
  ```rust
  #[tauri::command]
  fn copy_path(source: String, dest_dir: String) -> Result<String, String> {
      let src = Path::new(&source);
      let name = src.file_name().ok_or("invalid source")?.to_str().ok_or("non-UTF8 name")?;
      let dest = Path::new(&dest_dir).join(name);

      // Resolve trùng tên: file.md → file-copy.md → file-copy-2.md
      let dest = resolve_name_conflict(&dest);

      if src.is_dir() {
          copy_dir_recursive(src, &dest).map_err(|e| e.to_string())?;
      } else {
          std::fs::copy(src, &dest).map_err(|e| e.to_string())?;
      }
      Ok(dest.to_string_lossy().to_string())
  }
  ```
- Helper `resolve_name_conflict(path)`:
  - Nếu path chưa tồn tại → trả về path
  - Nếu đã tồn tại → thêm `-copy` trước extension: `file.md` → `file-copy.md`, `file-copy.md` → `file-copy-2.md`
- `copy_dir_recursive` dùng `walkdir` hoặc `std::fs` đệ quy
- Đăng ký trong `invoke_handler![]`
- Thêm vào `capabilities/default.json`: permission cho `$HOME/**`, `/tmp/**`, `/Volumes/**` (đã có scope)

**Acceptance:**
- Copy file `.md` giữa hai thư mục thành công
- Copy folder chứa `.md` files → toàn bộ children được copy
- Copy vào thư mục đã có file trùng tên → tự động đổi tên

**Complexity:** Trung bình — logic resolve tên + đệ quy folder

---

#### S2 — Store `fsui.ts`: clipboard state

**Goal:** Thêm state quản lý clipboard file/folder vào `fsui` store.

**Scope:**
- `fsui.ts`: thêm:
  ```ts
  const clipSource = ref<string | null>(null);   // source path
  const clipOp = ref<'copy' | 'cut' | null>(null);  // copy or move
  const clipIsDir = ref(false);
  ```
- `setClipboard(path: string, isDir: boolean, op: 'copy' | 'cut')`
- `clearClipboard()`
- Computed: `hasClipboard = clipSource != null`

**Complexity:** Rất thấp

---

#### S3 — Workspace store: `copyFile(source, destDir)` và `moveFile(source, destDir)`

**Goal:** Thêm hai action vào `workspace` store gọi Rust command và refresh tree.

**Scope:**
- `workspace.ts`:
  ```ts
  async function copyFile(source: string, destDir: string) {
    const newPath = await invoke<string>("copy_path", { source, destDir });
    // Refresh node tree ở destDir
    await refreshParentOf(newPath);
    return newPath;
  }

  async function moveFile(source: string, destDir: string) {
    const newPath = await invoke<string>("copy_path", { source, destDir });
    // Sau khi copy thành công, xóa source
    await invoke("delete_file", { path: source });
    // Refresh cả source parent và dest parent
    await refreshParentOf(source);
    await refreshParentOf(newPath);
    // Cập nhật tab path nếu file đang mở
    tabsStore.handleFileRenamed(source, newPath);
    return newPath;
  }
  ```
- Export `copyFile`, `moveFile`

**Acceptance:**
- Copy file → file mới xuất hiện trong tree đích, file gốc giữ nguyên
- Cut file → file biến mất ở source, xuất hiện ở dest, tab tự cập nhật path
- Copy folder → folder mới xuất hiện trong tree đích với toàn bộ nội dung

**Dependency:** S1 (Rust command), S2 (clipboard state)

**Complexity:** Thấp

---

#### S4 — ExplorerPanel: context menu "Copy" / "Cut" / "Paste"

**Goal:** Thêm 3 mục mới vào context menu của file/folder.

**Scope:**
- `ExplorerPanel.vue`: trong context menu (`.ctx-menu`):
  ```html
  <button class="ctx-item" @click="ctxCopy">Copy</button>
  <button class="ctx-item" @click="ctxCut">Cut</button>
  <div v-if="fsui.hasClipboard" class="ctx-separator"></div>
  <button v-if="fsui.hasClipboard && fsui.ctxMenu.isDir" class="ctx-item" @click="ctxPaste">
    Paste
  </button>
  ```
- `ctxCopy()`: gọi `fsui.setClipboard(path, isDir, 'copy')`
- `ctxCut()`: gọi `fsui.setClipboard(path, isDir, 'cut')`
- `ctxPaste()`:
  - Nếu `fsui.clipOp === 'copy'` → `workspace.copyFile(fsui.clipSource, targetDir)`
  - Nếu `fsui.clipOp === 'cut'` → `workspace.moveFile(fsui.clipSource, targetDir)`
  - Sau paste: `fsui.clearClipboard()`
- "Paste" chỉ hiển thị khi `ctxMenu.targetPath` là directory VÀ `fsui.hasClipboard === true`
- "Copy" và "Cut" hiển thị cho cả file và folder

**CSS `.ctx-separator`:**
```css
.ctx-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
```

**Acceptance:**
- Right-click file → thấy Copy, Cut
- Right-click folder → thấy Copy, Cut
- Sau khi Copy/Cut, right-click folder khác → thấy Paste
- Paste file → file xuất hiện, clipboard clear
- Cut+paste → file gốc biến mất, tab cập nhật path
- Copy folder đệ quy → toàn bộ nội dung được copy

**Dependency:** S2, S3

**Complexity:** Thấp

---

#### S5 — ExplorerPanel: Paste vào root header

**Goal:** Hỗ trợ paste trực tiếp vào workspace root header (khi clipboard có nội dung).

**Scope:**
- `ExplorerPanel.vue`: trong `.ws-root-actions`, thêm nút Paste (hiện khi `fsui.hasClipboard`):
  ```html
  <button v-if="fsui.hasClipboard" class="icon-btn ws-root-add" title="Paste" @click="pasteIntoRoot(root.path)">
    <Icon icon="lucide:clipboard-paste" width="14" height="14" />
  </button>
  ```
- `pasteIntoRoot(rootPath)` — logic giống `ctxPaste()` với `targetDir = rootPath`
- Nút hiện cùng hàng với Refresh, New File, New Folder trong `.ws-root-actions`
- Ẩn khi không có clipboard

**Dependency:** S2, S3, S4

**Complexity:** Rất thấp

---

### 1.3 Implementation Order

```
S1 (Rust copy_path) → S2 (clipboard state) → S3 (workspace actions)
                                                   → S4 (context menu)
                                                   → S5 (root paste)
```

---

## 2. Tour Guide Khi Lần Đầu Mở App

### 2.1 Phân tích

Người dùng mới mở app → màn hình trống "Add a folder to begin". Cần hướng dẫn từng bước các thao tác cơ bản.

**Yêu cầu:**
- Chỉ hiển thị một lần duy nhất (first-run)
- Overlay với spotlight highlight vào element đang được hướng dẫn
- Các bước tour:
  1. "Add a folder to begin" → hướng dẫn mở folder hoặc `.code-workspace`
  2. File tree → cách duyệt file, expand folder, click mở file
  3. Tabs → cách đóng tab, chuyển tab, kéo thả sắp xếp
  4. Editor → toolbar cơ bản (bold, italic, heading…)
  5. Preview → xem trước, toggle theme, print
  6. Command Palette → `Cmd/Ctrl+P` mở nhanh file
  7. Terminal → `Cmd/Ctrl+backtick` mở terminal
  8. Settings → đổi theme, kiểm tra update
- Nút "Skip tour" để thoát bất cứ lúc nào
- Nút "Next" / "Back" để điều hướng
- Progress indicator (dot hoặc "Step 3/8")

**Không dùng thư viện ngoài** — tự build bằng CSS overlay + teleport targeting.

### 2.2 Stories

#### S-T1 — Store: `ui.ts` tour state

**Goal:** Thêm state quản lý tour guide vào `ui` store.

**Scope:**
- `ui.ts`: thêm:
  ```ts
  const tourActive = ref(false);
  const tourStep = ref(0);
  const tourSeen = ref(false);  // persisted
  ```
- Actions: `startTour()`, `nextStep()`, `prevStep()`, `skipTour()`
- `skipTour()`: set `tourSeen = true`, persist vào `mdview-settings.json`
- `initTour()`: kiểm tra `tourSeen` từ store → nếu chưa seen, auto `startTour()` sau khi workspace loaded lần đầu

**Complexity:** Rất thấp

---

#### S-T2 — Component: `TourOverlay.vue`

**Goal:** Component overlay hiển thị tour guide với spotlight và tooltip.

**Scope:**
- `src/components/TourOverlay.vue`:
  - Overlay toàn màn hình (`position: fixed; inset: 0; z-index: 10000`)
  - Background dim (`background: rgba(0,0,0,0.5)`)
  - Spotlight: một "lỗ" trong overlay highlight element đang được hướng dẫn
  - Spotlight dùng `getBoundingClientRect()` của target element → clip-path hoặc mask
  - Tooltip card nằm cạnh element được highlight (tự chọn vị trí: bottom/top/right/left dựa trên không gian trống)
  - Tooltip nội dung:
    ```html
    <div class="tour-tooltip">
      <h3>{{ steps[currentStep].title }}</h3>
      <p>{{ steps[currentStep].description }}</p>
      <div class="tour-actions">
        <button @click="skip" class="tour-skip">Skip tour</button>
        <div class="tour-steps">{{ currentStep + 1 }} / {{ steps.length }}</div>
        <button v-if="currentStep > 0" @click="prev">Back</button>
        <button @click="next">{{ isLast ? 'Finish' : 'Next' }}</button>
      </div>
    </div>
    ```

- `steps` là mảng các bước tour, mỗi bước có:
  ```ts
  interface TourStep {
    title: string;
    description: string;
    selector: string;      // CSS selector của element cần highlight, null nếu không highlight
    position: 'bottom' | 'top' | 'right' | 'left';
  }
  ```

**Các bước tour:**

| # | Title | Description | Selector |
|---|-------|-------------|----------|
| 1 | Welcome to mdview | A markdown editor for your workspace. Let us show you around. | `.sidebar-empty` |
| 2 | Add a workspace | Start by adding a folder or opening a `.code-workspace` file. | `.sidebar-empty button` |
| 3 | File Explorer | Browse your files here. Click folders to expand, click `.md` files to open them. | `.sidebar` |
| 4 | Tabs | Open files appear as tabs. Drag to reorder, right-click for options, X to close. | `.tab-bar` |
| 5 | Editor | Edit your markdown with the toolbar: Bold, Italic, Headings, Lists, Links, Images… | `.md-toolbar` |
| 6 | Preview | See a live-rendered preview of your markdown. Toggle dark/light, or print. | `.preview-pane` |
| 7 | Command Palette | Press `Cmd/Ctrl+P` to quickly open any `.md` file by name. | null (modal hint) |
| 8 | Terminal | Press `` Cmd/Ctrl+` `` to open an integrated terminal at your workspace root. | null (key hint) |
| 9 | Settings | Click the gear icon to check for updates or change the theme. | `.tab-bar-actions` |

- **Guard:** Nếu element không tồn tại (VD: chưa mở workspace) → skip bước đó hoặc chờ
- `onMounted`: lắng nghe `ui.tourStep` thay đổi để reposition spotlight
- ResizeObserver reposition khi window resize

**Acceptance:**
- Tour hiển thị overlay với spotlight vào đúng element
- Click Next/Back điều hướng qua các bước
- Skip tour → overlay biến mất, không bao giờ hiện lại
- Spotlight tự reposition khi resize window
- Bước không có selector (command palette, terminal) → chỉ hiện tooltip ở giữa màn hình

**Complexity:** Trung bình — spotlight mask + positioning logic

---

#### S-T3 — App.vue: wire tour vào startup flow

**Goal:** Kích hoạt tour sau khi workspace loaded lần đầu nếu chưa seen.

**Scope:**
- `App.vue`:
  - Sau `workspace.restoreWorkspace()` hoàn tất → gọi `ui.initTour()`
  - `initTour()`: nếu `!tourSeen` VÀ `hasWorkspace` (workspace đã có) → `startTour()`
  - Hoặc: nếu `!tourSeen` VÀ user vừa add folder → `startTour()` sau khi tree load
- Import `TourOverlay` và mount trong template:
  ```html
  <TourOverlay v-if="ui.tourActive" />
  ```
- TourOverlay nhận `@close` → `ui.skipTour()`

**Dependency:** S-T1, S-T2

**Complexity:** Thấp

---

### 2.3 Implementation Order

```
S-T1 (state) → S-T2 (component) → S-T3 (wire vào App)
```

---

## 3. Hỗ Trợ Ngôn Ngữ Tiếng Việt (i18n)

### 3.1 Phân tích

Toàn bộ app hiện hardcode tiếng Anh — ~65 text strings trong template, tooltip, placeholder, confirm dialog. Cần cơ chế i18n nhẹ:

**Phương án: `vue-i18n`**
- Nặng (30KB gzipped), runtime overhead
- Cần tạo message bundle, plugin setup

**Phương án: Composable i18n tự build**
- Nhẹ, chỉ cần reactive dictionary + composable `useI18n()`
- Store language preference trong `mdview-settings.json`
- Component `<template>` dùng `$t()` hoặc `t()` function
- Phù hợp scale hiện tại (~65 strings)

**Chọn composable tự build** — không cần thêm dependency.

**Strings cần dịch (~65 keys):**
Xem danh sách đầy đủ trong S-I1.

**Language switcher:**
- Settings modal: thêm dropdown chọn ngôn ngữ (English / Tiếng Việt)
- Mặc định: English (để không gây shock cho user quốc tế)
- Detect từ system language? Optional (để sau)

### 3.2 Stories

#### S-I1 — `src/i18n/` — dictionary + composable

**Goal:** Tạo module i18n với dictionary tiếng Anh và tiếng Việt.

**Scope:**
- `src/i18n/index.ts`:
  ```ts
  import { ref, computed, type Ref } from 'vue';

  export type Locale = 'en' | 'vi';

  // Dictionary: key → { en, vi }
  const messages: Record<string, { en: string; vi: string }> = {
    // --- App shell ---
    'app.empty.noWorkspace': { en: 'Add a folder to begin.', vi: 'Thêm thư mục để bắt đầu.' },
    'app.empty.selectFile': { en: 'Select a .md file from the sidebar, or press ⌘+P.', vi: 'Chọn file .md từ sidebar, hoặc nhấn ⌘+P.' },

    // --- Explorer ---
    'explorer.title': { en: 'File Explorer', vi: 'File Explorer' },
    'explorer.outline': { en: 'Outline (TOC)', vi: 'Mục lục (TOC)' },
    'explorer.addFolder': { en: 'Add Folder', vi: 'Thêm thư mục' },
    'explorer.openWorkspace': { en: 'Open Workspace...', vi: 'Mở Workspace...' },
    'explorer.addFolderToWs': { en: 'Add Folder to Workspace', vi: 'Thêm thư mục vào Workspace' },
    'explorer.saveWs': { en: 'Save as Workspace...', vi: 'Lưu thành Workspace...' },
    'explorer.closeWs': { en: 'Close workspace', vi: 'Đóng workspace' },
    'explorer.refresh': { en: 'Refresh Explorer', vi: 'Làm mới Explorer' },
    'explorer.newFile': { en: 'New file in this root', vi: 'Tạo file mới' },
    'explorer.newFolder': { en: 'New folder in this root', vi: 'Tạo thư mục mới' },
    'explorer.noFolder': { en: 'No folder opened.', vi: 'Chưa mở thư mục nào.' },
    'explorer.loading': { en: 'Loading...', vi: 'Đang tải...' },
    'explorer.noMdFiles': { en: 'No .md files found.', vi: 'Không tìm thấy file .md.' },
    'explorer.recent': { en: 'Recent', vi: 'Gần đây' },

    // --- Context menu ---
    'ctx.newFile': { en: 'New File', vi: 'Tạo file mới' },
    'ctx.newFolder': { en: 'New Folder', vi: 'Tạo thư mục mới' },
    'ctx.rename': { en: 'Rename', vi: 'Đổi tên' },
    'ctx.delete': { en: 'Delete', vi: 'Xóa' },
    'ctx.copy': { en: 'Copy', vi: 'Sao chép' },
    'ctx.cut': { en: 'Cut', vi: 'Cắt' },
    'ctx.paste': { en: 'Paste', vi: 'Dán' },
    'ctx.removeRoot': { en: 'Remove Folder from Workspace', vi: 'Xóa thư mục khỏi Workspace' },

    // --- Tabs ---
    'tab.close': { en: 'Close', vi: 'Đóng' },
    'tab.closeAll': { en: 'Close All Tabs', vi: 'Đóng tất cả tab' },
    'tab.closeTooltip': { en: 'Close (Cmd/Ctrl+W)', vi: 'Đóng (Cmd/Ctrl+W)' },
    'tab.newTerminal': { en: 'New Terminal', vi: 'Terminal mới' },
    'tab.closePanel': { en: 'Close panel', vi: 'Đóng panel' },

    // --- Editor toolbar ---
    'toolbar.bold': { en: 'Bold (Cmd/Ctrl+B)', vi: 'In đậm (Cmd/Ctrl+B)' },
    'toolbar.italic': { en: 'Italic (Cmd/Ctrl+I)', vi: 'In nghiêng (Cmd/Ctrl+I)' },
    'toolbar.heading': { en: 'Heading (cycle H1-H3)', vi: 'Heading (H1→H2→H3)' },
    'toolbar.underline': { en: 'Underline', vi: 'Gạch chân' },
    'toolbar.strikethrough': { en: 'Strikethrough', vi: 'Gạch ngang' },
    'toolbar.orderedList': { en: 'Ordered list', vi: 'Danh sách có thứ tự' },
    'toolbar.unorderedList': { en: 'Unordered list', vi: 'Danh sách không thứ tự' },
    'toolbar.checklist': { en: 'Checklist', vi: 'Checklist' },
    'toolbar.quote': { en: 'Quote', vi: 'Trích dẫn' },
    'toolbar.codeBlock': { en: 'Code block', vi: 'Khối code' },
    'toolbar.table': { en: 'Table', vi: 'Bảng' },
    'toolbar.link': { en: 'Link', vi: 'Liên kết' },
    'toolbar.image': { en: 'Image', vi: 'Hình ảnh' },
    'toolbar.wordWrap': { en: 'Toggle Word Wrap', vi: 'Toggle Word Wrap' },
    'toolbar.openBrowser': { en: 'Open preview in browser', vi: 'Mở preview trong trình duyệt' },

    // --- Preview ---
    'preview.print': { en: 'Print / Export PDF', vi: 'In / Xuất PDF' },
    'preview.light': { en: 'Switch preview to light', vi: 'Preview sáng' },
    'preview.dark': { en: 'Switch preview to dark', vi: 'Preview tối' },
    'preview.empty': { en: 'Preview will appear here.', vi: 'Preview sẽ hiển thị ở đây.' },
    'preview.loading': { en: 'Loading {name}...', vi: 'Đang tải {name}...' },

    // --- Theme ---
    'theme.light': { en: 'Switch to light theme', vi: 'Giao diện sáng' },
    'theme.dark': { en: 'Switch to dark theme', vi: 'Giao diện tối' },

    // --- Terminal ---
    'terminal.toggle': { en: 'Toggle Terminal (Cmd/Ctrl+`)', vi: 'Terminal (Cmd/Ctrl+`)' },

    // --- Sidebar ---
    'sidebar.collapse': { en: 'Collapse Sidebar (Cmd/Ctrl+B)', vi: 'Thu gọn Sidebar (Cmd/Ctrl+B)' },

    // --- Settings ---
    'settings.title': { en: 'Settings', vi: 'Cài đặt' },
    'settings.about': { en: 'About', vi: 'Thông tin' },
    'settings.updates': { en: 'Updates', vi: 'Cập nhật' },
    'settings.version': { en: 'Version', vi: 'Phiên bản' },
    'settings.author': { en: 'Author', vi: 'Tác giả' },
    'settings.license': { en: 'License', vi: 'Giấy phép' },
    'settings.github': { en: 'GitHub', vi: 'GitHub' },
    'settings.close': { en: 'Close', vi: 'Đóng' },
    'settings.language': { en: 'Language', vi: 'Ngôn ngữ' },
    'settings.langEn': { en: 'English', vi: 'Tiếng Anh' },
    'settings.langVi': { en: 'Tiếng Việt', vi: 'Tiếng Việt' },
    'settings.checkUpdate': { en: 'Check for Updates', vi: 'Kiểm tra cập nhật' },
    'settings.checkNow': { en: 'Check now', vi: 'Kiểm tra ngay' },
    'settings.checking': { en: 'Checking for updates...', vi: 'Đang kiểm tra cập nhật...' },
    'settings.latest': { en: 'You\'re on the latest version.', vi: 'Bạn đang dùng phiên bản mới nhất.' },
    'settings.available': { en: '{version} is available.', vi: '{version} đã có sẵn.' },
    'settings.downloading': { en: 'Downloading... {percent}%', vi: 'Đang tải... {percent}%' },
    'settings.ready': { en: 'Update downloaded — installing.', vi: 'Đã tải xong — đang cài đặt.' },
    'settings.error': { en: 'Update check failed.', vi: 'Kiểm tra cập nhật thất bại.' },
    'settings.autoCheck': { en: 'mdview checks automatically on startup.', vi: 'mdview tự động kiểm tra khi khởi động.' },

    // --- Update modal ---
    'update.title': { en: '{name} {version} available', vi: '{name} {version} đã có sẵn' },
    'update.current': { en: 'current: {version}', vi: 'hiện tại: {version}' },
    'update.downloading': { en: 'Downloading... {percent}% ({downloaded} / {total})', vi: 'Đang tải... {percent}% ({downloaded} / {total})' },
    'update.complete': { en: 'Download complete', vi: 'Tải xong' },
    'update.failed': { en: 'Update failed', vi: 'Cập nhật thất bại' },
    'update.releaseNotes': { en: 'Release notes', vi: 'Ghi chú phiên bản' },
    'update.later': { en: 'Later', vi: 'Để sau' },
    'update.install': { en: 'Install & Restart', vi: 'Cài đặt & Khởi động lại' },
    'update.goDownload': { en: 'Go to Download Page', vi: 'Đến trang tải xuống' },
    'update.tryAgain': { en: 'Try again', vi: 'Thử lại' },
    'update.close': { en: 'Close', vi: 'Đóng' },

    // --- Command palette ---
    'palette.placeholder': { en: 'Search files by name...', vi: 'Tìm file theo tên...' },
    'palette.noMatches': { en: 'No matches.', vi: 'Không tìm thấy.' },

    // --- Input placeholders ---
    'input.filename': { en: 'filename.md', vi: 'ten-file.md' },
    'input.foldername': { en: 'folder-name', vi: 'ten-thu-muc' },
    'input.rename': { en: 'new name', vi: 'tên mới' },

    // --- Confirm dialogs ---
    'confirm.deleteTitle': { en: 'Delete file', vi: 'Xóa file' },
    'confirm.deleteMsg': { en: 'Delete "{name}"? This cannot be undone.', vi: 'Xóa "{name}"? Hành động này không thể hoàn tác.' },
    'confirm.unsavedTitle': { en: 'Unsaved changes', vi: 'Chưa lưu thay đổi' },
    'confirm.unsavedMsg': { en: '"{name}" has unsaved changes. Close without saving?', vi: '"{name}" có thay đổi chưa lưu. Đóng mà không lưu?' },
    'confirm.closeAllTitle': { en: 'Close all tabs', vi: 'Đóng tất cả tab' },
    'confirm.closeAllMsg': { en: '{n} file(s) have unsaved changes. Close all without saving?', vi: '{n} file có thay đổi chưa lưu. Đóng tất cả?' },

    // --- Error messages ---
    'error.folderNotFound': { en: 'folder not found', vi: 'không tìm thấy thư mục' },
    'error.wsFileNotFound': { en: 'Workspace file not found: {path}', vi: 'Không tìm thấy file workspace: {path}' },
    'error.wsFolderNotFound': { en: 'Workspace folder not found: {path}', vi: 'Không tìm thấy thư mục workspace: {path}' },
    'error.emptyFolderName': { en: 'empty folder name', vi: 'tên thư mục trống' },
    'error.folderNameSlash': { en: 'folder name cannot contain path separators', vi: 'tên thư mục không được chứa dấu phân cách đường dẫn' },

    // --- Tour ---
    'tour.skip': { en: 'Skip tour', vi: 'Bỏ qua' },
    'tour.next': { en: 'Next', vi: 'Tiếp' },
    'tour.back': { en: 'Back', vi: 'Quay lại' },
    'tour.finish': { en: 'Finish', vi: 'Hoàn tất' },
    'tour.step1.title': { en: 'Welcome to mdview', vi: 'Chào mừng đến với mdview' },
    'tour.step1.desc': { en: 'A markdown editor for your workspace. Let us show you around.', vi: 'Trình soạn thảo markdown cho workspace của bạn. Hãy cùng khám phá.' },
    'tour.step2.title': { en: 'Add a workspace', vi: 'Thêm workspace' },
    'tour.step2.desc': { en: 'Start by adding a folder or opening a .code-workspace file.', vi: 'Bắt đầu bằng cách thêm thư mục hoặc mở file .code-workspace.' },
    'tour.step3.title': { en: 'File Explorer', vi: 'File Explorer' },
    'tour.step3.desc': { en: 'Browse your files here. Click folders to expand, click .md files to open them.', vi: 'Duyệt file ở đây. Click thư mục để mở rộng, click file .md để mở.' },
    'tour.step4.title': { en: 'Tabs', vi: 'Tab' },
    'tour.step4.desc': { en: 'Open files appear as tabs. Drag to reorder, right-click for options.', vi: 'File đã mở hiển thị dạng tab. Kéo để sắp xếp, click phải để xem tùy chọn.' },
    'tour.step5.title': { en: 'Editor Toolbar', vi: 'Thanh công cụ' },
    'tour.step5.desc': { en: 'Format text with the toolbar: Bold, Italic, Headings, Lists, Links, Images...', vi: 'Định dạng văn bản: In đậm, In nghiêng, Heading, Danh sách, Liên kết, Hình ảnh...' },
    'tour.step6.title': { en: 'Live Preview', vi: 'Xem trước' },
    'tour.step6.desc': { en: 'See a live-rendered preview. Toggle dark/light theme, or export to PDF.', vi: 'Xem trước trực tiếp. Chuyển đổi giao diện sáng/tối, hoặc xuất PDF.' },
    'tour.step7.title': { en: 'Command Palette', vi: 'Bảng lệnh' },
    'tour.step7.desc': { en: 'Press Cmd/Ctrl+P to quickly open any .md file by name.', vi: 'Nhấn Cmd/Ctrl+P để mở nhanh file .md theo tên.' },
    'tour.step8.title': { en: 'Terminal', vi: 'Terminal' },
    'tour.step8.desc': { en: 'Press Cmd/Ctrl+` to open an integrated terminal at your workspace root.', vi: 'Nhấn Cmd/Ctrl+` để mở terminal tích hợp tại thư mục workspace.' },
    'tour.step9.title': { en: 'Settings', vi: 'Cài đặt' },
    'tour.step9.desc': { en: 'Click the gear icon to change theme, language, or check for updates.', vi: 'Click biểu tượng bánh răng để đổi giao diện, ngôn ngữ, hoặc kiểm tra cập nhật.' },
  };
  ```

- `src/i18n/index.ts` (tiếp):
  ```ts
  const currentLocale: Ref<Locale> = ref('en');

  function t(key: string, params?: Record<string, string | number>): string {
    const msg = messages[key];
    if (!msg) return key;
    let text = msg[currentLocale.value] || msg.en;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  }

  function setLocale(locale: Locale) {
    currentLocale.value = locale;
  }

  function initLocale(): Promise<void> {
    // Load từ mdview-settings.json
    const store = new Store('mdview-settings.json');
    return store.get<Locale>('locale').then((v) => {
      if (v === 'en' || v === 'vi') currentLocale.value = v;
    }).catch(() => {});
  }

  export function useI18n() {
    return { t, currentLocale, setLocale, initLocale };
  }
  ```

**Acceptance:**
- Gọi `t('explorer.title')` trả về "File Explorer" (en) hoặc "File Explorer" (vi)
- Gọi `t('confirm.unsavedMsg', { name: 'readme.md' })` → thay `{name}` = `readme.md`
- `setLocale('vi')` → tất cả `t()` call reactive cập nhật

**Complexity:** Trung bình — khối lượng lớn nhất là dictionary

---

#### S-I2 — SettingsModal: language switcher

**Goal:** Thêm dropdown chọn ngôn ngữ vào Settings modal.

**Scope:**
- `SettingsModal.vue`: thêm section "Language" với 2 radio hoặc select:
  ```html
  <div class="settings-section">
    <h3>{{ t('settings.language') }}</h3>
    <select v-model="selectedLocale" @change="changeLocale">
      <option value="en">{{ t('settings.langEn') }}</option>
      <option value="vi">{{ t('settings.langVi') }}</option>
    </select>
  </div>
  ```
- `changeLocale()`: gọi `setLocale(val)` + persist `locale` vào `mdview-settings.json`
- Import `useI18n` từ `src/i18n`

**Dependency:** S-I1

**Complexity:** Rất thấp

---

#### S-I3 — Migrate từng component sang `t()`

**Goal:** Thay thế toàn bộ hardcoded string trong template bằng `t()` call.

**Scope:**
- Các file cần migrate (theo thứ tự ưu tiên):
  1. `ExplorerPanel.vue` — title, empty states, context menu, placeholders, buttons
  2. `TabBar.vue` — tooltips, context menu
  3. `SourceEditor.vue` — toolbar tooltips
  4. `PreviewPane.vue` — toolbar tooltips, empty state
  5. `SettingsModal.vue` — section headers, labels
  6. `UpdateModal.vue` — title, labels, buttons
  7. `CommandPalette.vue` — placeholder, no-match message
  8. `BottomPanel.vue` — tooltips
  9. `TerminalTabBar.vue` — buttons
  10. `EditorArea.vue` — loading message
  11. `App.vue` — empty state messages
  12. `FileTreeNode.vue` — rename placeholder
  13. `TourOverlay.vue` — toàn bộ nội dung tour

- Pattern trong component:
  ```ts
  import { useI18n } from '../i18n';
  const { t } = useI18n();
  ```
- Template: `:title="t('key')"` hoặc `{{ t('key') }}`

- Confirm dialog (`@tauri-apps/plugin-dialog`):
  - `workspace.ts`, `tabs.ts`: import `useI18n` → gọi `t()` cho title/message
  - Hoặc truyền `t` function từ component vào store (pinia có thể import i18n)

**Dependency:** S-I1

**Complexity:** Thấp — chủ yếu find-and-replace

---

#### S-I4 — i18n: persist + restore locale preference

**Goal:** Lưu ngôn ngữ đã chọn vào `mdview-settings.json`, khôi phục khi khởi động.

**Scope:**
- `App.vue`: gọi `initLocale()` trong `onMounted` (trước khi render giao diện)
- `SettingsModal.vue`: sau `changeLocale()`, persist qua `@tauri-apps/plugin-store`:
  ```ts
  import { Store } from '@tauri-apps/plugin-store';
  const store = new Store('mdview-settings.json');
  await store.set('locale', val);
  await store.save();
  ```
- `src/i18n/index.ts`: `initLocale()` load từ store như mô tả ở S-I1

**Dependency:** S-I1, S-I2

**Complexity:** Rất thấp

---

### 3.3 Implementation Order

```
S-I1 (dictionary + composable) → S-I2 (settings language switcher)
                              → S-I3 (migrate component templates)
                              → S-I4 (persist + restore)
```

---

## 4. Tổng Hợp

### Dependency Graph

```
PDF Fix:      S-B1 → S-B2

Copy-Paste:   S1 → S2 → S3 → S4
                          → S5

Tour:         S-T1 → S-T2 → S-T3

i18n:         S-I1 → S-I2
                  → S-I3
                  → S-I4
```

### Complexity Summary

| Story | Feature | Complexity | Frontend-only? |
|-------|---------|------------|---------------|
| S-B1 | buildStandaloneHtml + print CSS | Thấp | ✅ |
| S-B2 | Đổi flow Print | Thấp | ✅ |
| S1 | Rust `copy_path` command | Trung bình | ❌ (Rust) |
| S2 | fsui clipboard state | Rất thấp | ✅ |
| S3 | workspace copyFile/moveFile | Thấp | ✅ |
| S4 | Context menu Copy/Cut/Paste | Thấp | ✅ |
| S5 | Root header Paste button | Rất thấp | ✅ |
| S-T1 | ui store tour state | Rất thấp | ✅ |
| S-T2 | TourOverlay component | Trung bình | ✅ |
| S-T3 | Wire tour vào App startup | Thấp | ✅ |
| S-I1 | i18n dictionary + composable | Trung bình | ✅ |
| S-I2 | Settings language switcher | Rất thấp | ✅ |
| S-I3 | Migrate components sang `t()` | Thấp | ✅ |
| S-I4 | Persist + restore locale | Rất thấp | ✅ |

**v1.5.0 gần như frontend-only** — chỉ có 1 Rust command mới (`copy_path`). Không cần package mới.

### New Files (Expected)

```
src/i18n/index.ts                       (S-I1) — dictionary + composable
src/components/TourOverlay.vue          (S-T2) — tour guide overlay
```

### Modified Files (Expected)

```
src-tauri/src/lib.rs                   (S1) — copy_path command + invoke_handler
src-tauri/capabilities/default.json    (S1) — FS permission (already scoped)
src/stores/fsui.ts                     (S2) — clipboard state
src/stores/workspace.ts                (S3) — copyFile, moveFile
src/stores/ui.ts                       (S-T1) — tour state
src/components/ExplorerPanel.vue       (S4, S5) — context menu + root paste button
src/components/SettingsModal.vue       (S-I2) — language switcher
src/components/PreviewPane.vue         (S-B1) — buildStandaloneHtml print CSS
src/components/EditorArea.vue          (S-B2) — flow print
src/components/TabBar.vue              (S-I3) — t() migrate
src/components/SourceEditor.vue        (S-I3) — toolbar t() migrate
src/components/UpdateModal.vue         (S-I3) — t() migrate
src/components/CommandPalette.vue      (S-I3) — t() migrate
src/components/BottomPanel.vue         (S-I3) — t() migrate
src/components/TerminalTabBar.vue      (S-I3) — t() migrate
src/components/FileTreeNode.vue        (S-I3) — placeholder t() migrate
src/App.vue                            (S-T3, S-I4) — tour wire + locale init
src/stores/tabs.ts                     (S-I3) — confirm dialog i18n
```
