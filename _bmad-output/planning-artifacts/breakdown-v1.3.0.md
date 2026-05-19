---
title: "mdview v1.3.0 — Feature Breakdown"
version: 1.3.0
created: 2026-05-19
status: planning
---

# v1.3.0 Feature Breakdown

Bốn tính năng bổ sung sau khi các feature hiện tại đã hoàn thành: **Remove Folder khỏi Workspace**, **Di chuyển nút Sidebar Toggle sang phải**, **Fix Scroll Sync hai chiều**, **Tìm kiếm trong Editor (Cmd+F)**.

---

## Các tính năng đã hoàn thành (v1.3.0 hiện tại)

Các feature từ roadmap cũ đã implement và đang hoạt động:

- **BUG-1 (Updater)**: `releaseDraft: false`, `updaterJsonKeepUniversal` — release publish tự động, endpoint updater hoạt động.
- **BUG-2 (New file toolbar)**: `startRootCreate()` dùng `tabs.activeTab?.path` để xác định thư mục cha thay vì luôn dùng root.
- **FEAT-1 (Create folder)**: `create_dir` Rust command + `pendingCreateDirInDir` frontend state.
- **FEAT-2 (Slash auto-create dirs)**: `create_md_file` gọi `create_dir_all(&target_dir)` cho intermediate dirs.
- **FEAT-3 (Settings modal + native menu)**: `open-settings` Tauri event + `SettingsModal.vue` + native menu item `Cmd+,`.
- **FEAT-4 (Workspace management)**: `saveCurrentWorkspace`, `saveAsNewWorkspace`, `addFolderToCurrentWorkspace` trong `workspace` store.
- **FEAT-5 (Activity Bar + sidebar resize)**: Activity buttons đã chuyển vào `ExplorerPanel.vue` `.sidebar-activity-row`; `Sidebar.vue` có resize handle với `sidebarWidth` clamp 140–480px.

---

## 1. Remove Folder khỏi Workspace hiện tại

### 1.1 Phân tích

Workspace hiện tại hỗ trợ multi-root (`roots: WorkspaceRoot[]`) và đã có `removeWorkspace()` xóa toàn bộ workspace. Tuy nhiên chưa có cách remove một root cụ thể khỏi multi-root workspace mà không đóng toàn bộ.

**Luồng mong đợi:**
1. User right-click vào header của một root trong Explorer (`.ws-root-header`)
2. Context menu hiện ra với mục "Remove Folder from Workspace"
3. Click → root bị xóa khỏi `roots` array
4. Các tab đang mở thuộc root đó tự động đóng
5. Nếu chỉ còn 1 root, revert về trạng thái single-root (không còn workspace file context)

### 1.2 Stories

#### S1 — Store: `removeRoot(rootPath)`

**Goal:** Thêm action `removeRoot(rootPath)` vào `workspace` store.

**Scope:**
- Filter `roots.value = roots.value.filter(r => r.path !== rootPath)`
- Duyệt các tab đang mở trong `tabs` store: đóng các tab có path nằm trong root bị xóa (gọi `tabs.closeTab` không confirm nếu dirty — hoặc confirm nếu unsaved)
- Nếu sau khi xóa chỉ còn 1 root: đặt `workspaceFile.value = null`, lưu `workspace_path` thay vì `workspace_file` vào store
- Nếu sau khi xóa còn nhiều root: gọi `saveCurrentWorkspace()` để cập nhật file `.code-workspace`
- Nếu sau khi xóa còn 0 root: gọi `removeWorkspace()` toàn bộ
- Update persist key phù hợp (`workspace_path` hoặc `workspace_file`) qua `getStore()`

**Acceptance:**
- Xóa root khỏi multi-root workspace không ảnh hưởng các root còn lại
- Tab thuộc root bị xóa tự động đóng (có confirm nếu dirty)
- Persist state đúng sau khi xóa

**Dependency:** Tab store (`useTabsStore`) đã import trong `workspace.ts`

**Complexity:** Trung bình — cần xử lý edge cases (tab dirty, single-root fallback, persist)

---

#### S2 — UI: Context menu trên `.ws-root-header`

**Goal:** Right-click vào header của mỗi root trong Explorer hiện context menu với "Remove Folder from Workspace".

**Scope:**
- `ExplorerPanel.vue`: thêm `@contextmenu.prevent` handler trên `.ws-root-header`
- Dùng `fsui` store pattern hiện có (`showContextMenu`) hoặc tạo dedicated context menu inline
- Menu item: icon `lucide:folder-minus` + text "Remove Folder from Workspace"
- Click → `workspace.removeRoot(root.path)`
- Không hiện menu item nếu chỉ có 1 root (giữ lại `removeWorkspace()` button hiện tại trong `.sidebar-actions`)

**Acceptance:**
- Right-click trên root header → context menu hiển thị
- "Remove Folder from Workspace" có mặt trong menu
- Click execute → root biến mất khỏi tree, tabs liên quan đóng
- Context menu đóng sau khi click

**Dependency:** S1

**Complexity:** Thấp — pattern context menu đã có sẵn từ file management

---

### 1.3 Implementation Order

```
S1 (store removeRoot) → S2 (context menu UI)
```

---

## 2. Di chuyển nút Sidebar Toggle sang bên phải

### 2.1 Phân tích

Hiện tại nút toggle sidebar (Cmd+B) nằm trong `app-header-left`. Yêu cầu: chuyển sang `app-header-right` cùng hàng với nút Theme và Settings.

**Trước:**
```
[PanelLeftIcon]          mdview          [SunIcon] [SettingsIcon]
```

**Sau:**
```
                         mdview          [SunIcon] [SettingsIcon] [PanelLeftIcon]
```

### 2.2 Stories

#### S3 — Di chuyển button trong AppHeader.vue

**Goal:** Chuyển button sidebar toggle từ `app-header-left` sang `app-header-right`.

**Scope:**
- `AppHeader.vue`: xóa `<button class="icon-btn" @click="ui.toggleSidebar()">` khỏi `.app-header-left`
- Thêm vào `.app-header-right` (trước hoặc sau theme button, không quan trọng)
- Giữ nguyên icon conditional: `lucide:panel-left-close` khi sidebar mở, `lucide:panel-left` khi đóng
- Giữ nguyên title attribute + tooltip text

**Không thay đổi:**
- Shortcut `Cmd/Ctrl+B` trong `App.vue` vẫn hoạt động bình thường
- Activity button "Collapse Sidebar" trong `.sidebar-activity-row` vẫn giữ nguyên

**Complexity:** Rất thấp — chỉ move markup

---

## 3. Fix lỗi Scroll Sync hai chiều

### 3.1 Phân tích

Hiện tại `EditorArea.vue` có scroll sync **một chiều**: `SourceEditor` emit scroll percent → `EditorArea` pass cho `PreviewPane`. Khi user scroll trong Preview, editor không scroll theo.

**Luồng cần bổ sung:**
```
PreviewPane scroll → emit scroll percent ngược → EditorArea → SourceEditor.scrollTo(percent)
```

CodeMirror 6 hỗ trợ `EditorView.scrollDOM` hoặc `scrollIntoView` — cần một approach để set scroll position từ bên ngoài.

**File liên quan:**
| File | Vai trò |
|------|---------|
| `EditorArea.vue` | Trung gian — nhận scroll từ cả hai phía |
| `SourceEditor.vue` | Emit scroll percent từ CM (đã có). Cần thêm `setScrollPercent(n)` exposed method hoặc prop watch |
| `PreviewPane.vue` | Nhận scroll percent từ editor (đã có). Cần emit scroll percent khi user scroll preview |

### 3.2 Stories

#### S4 — PreviewPane emit scroll percent

**Goal:** Khi user scroll `.markdown-body` trong Preview, emit scroll percent ra ngoài.

**Scope:**
- `PreviewPane.vue`: thêm `const emit = defineEmits<{ scroll: [pct: number] }>()`
- Thêm `scroll` event listener trên `.markdown-body` element
- Tính toán `scrollTop / (scrollHeight - clientHeight)` → emit
- **Chỉ emit từ user scroll**, không emit khi `applyScroll()` programmatic set (dùng flag hoặc guard)

**Guard programmatic scroll:**
```ts
let programmaticScroll = false;
function applyScroll() {
  programmaticScroll = true;
  // ... set scrollTop ...
  // Dùng requestAnimationFrame hoặc setTimeout để reset flag
}
// Trong scroll event handler:
if (programmaticScroll) { programmaticScroll = false; return; }
```

**Acceptance:**
- User scroll preview → `EditorArea` nhận event `@scroll`
- Preview scroll programmatic (do editor scroll thay đổi) → không emit loop

**Complexity:** Thấp

---

#### S5 — SourceEditor nhận scroll percent ngược

**Goal:** `SourceEditor.vue` có thể nhận scroll percent từ bên ngoài và set vị trí scroll của CodeMirror.

**Scope:**
- `SourceEditor.vue`: thêm prop `scrollPercent: number` hoặc expose method `setScrollPercent(pct: number)`
- Dùng CM's `EditorView.scrollDOM` để set `scrollTop`:
  ```ts
  function setScrollPercent(pct: number) {
    if (!view) return;
    const dom = view.scrollDOM;
    const target = pct * (dom.scrollHeight - dom.clientHeight);
    dom.scrollTop = target;
  }
  ```
- Watch prop `scrollPercent` → gọi `setScrollPercent`
- Guard: track programmatic scroll (tương tự S4) để không re-emit khi editor tự scroll do nhận percent

**Dependency:** S4

**Acceptance:**
- Preview scroll → editor scroll đồng bộ
- Editor scroll → preview scroll đồng bộ (giữ nguyên hành vi hiện tại)
- Không vòng lặp vô hạn: editor → preview → editor → ...

**Complexity:** Thấp

---

#### S6 — EditorArea wire two-way scroll

**Goal:** Kết nối scroll hai chiều trong `EditorArea.vue`.

**Scope:**
- `EditorArea.vue`:
  - Thêm `@scroll` listener trên `<PreviewPane>`
  - Thêm prop `scrollPercent` hoặc method call trên `<SourceEditor>`
  - Refactor: một `scrollPercent` duy nhất nhưng guard loop với source flag
- Pattern hai chiều:
  ```ts
  let scrollSource: "editor" | "preview" | null = null;

  function onEditorScroll(pct: number) {
    if (scrollSource === "preview") { scrollSource = null; return; }
    scrollSource = "editor";
    scrollPercent.value = pct;
    requestAnimationFrame(() => { scrollSource = null; });
  }

  function onPreviewScroll(pct: number) {
    if (scrollSource === "editor") { scrollSource = null; return; }
    scrollSource = "preview";
    previewScrollPercent.value = pct;
    requestAnimationFrame(() => { scrollSource = null; });
  }
  ```
- Truyền `editorScrollPercent` xuống Preview (như hiện tại), và `previewScrollPercent` xuống SourceEditor (mới)

**Dependency:** S4, S5

**Complexity:** Trung bình — cần tránh infinite scroll loop

---

### 3.3 Implementation Order

```
S4 (Preview emit) → S5 (Editor receive) → S6 (wire together)
```

---

## 4. Tìm kiếm trong Editor (Cmd+F)

### 4.1 Phân tích

CodeMirror 6 có built-in search panel qua package `@codemirror/search`. Package này chưa được cài trong `package.json`. Cần:

1. Cài `@codemirror/search` package
2. Wire `openSearchPanel` command vào CM keymap
3. `Cmd/Ctrl+F` mở search panel, `Escape` đóng

CodeMirror search panel là overlay hiển thị ở đầu editor, hỗ trợ:
- Tìm kiếm text trong document
- Next/Previous match (Enter / Shift+Enter)
- Highlight tất cả matches
- Case sensitive toggle
- Regex toggle
- Replace (với `gotoReplacePanel` command)

### 4.2 Stories

#### S7 — Cài đặt và wire `@codemirror/search`

**Goal:** Thêm search panel vào CodeMirror editor.

**Scope:**
- `pnpm add @codemirror/search` (không cần pin version cụ thể — đã dùng `^` ranges)
- `SourceEditor.vue`: import `searchKeymap` từ `@codemirror/search` và thêm vào `keymap` array
- Import `highlightSelectionMatches` extension nếu muốn highlight tất cả matches
- Register command `openSearchPanel` trong keymap:
  ```ts
  import { searchKeymap } from "@codemirror/search"
  import { highlightSelectionMatches } from "@codemirror/search"
  
  // Trong extensions array:
  keymap.of([...searchKeymap]),
  highlightSelectionMatches(),
  ```

**Không cần thay đổi:**
- `Cursor/Ctrl+F` đã được wire trong `App.vue` global handler nhưng chưa làm gì — search panel sẽ capture sự kiện này qua CM keymap nội bộ khi editor focused
- Không cần thêm prop hay emit mới

**Acceptance:**
- `/Cmd+F` trong editor → search panel mở ở đầu editor
- Gõ text → matches được highlight
- Enter → next match; Shift+Enter → prev match
- Escape → đóng search panel
- Regex toggle, case-sensitive toggle hoạt động
- `/Cmd+F` khi không focus vào editor → không có hiệu ứng (hoặc có thể dispatch sự kiện cho webview mặc định)

**Complexity:** Thấp — CM search là built-in extension

---

## 5. Tổng hợp

### Dependency Graph

```
Feature 1 (Remove Folder):  S1 → S2

Feature 2 (Sidebar Toggle): S3 (độc lập)

Feature 3 (Scroll Sync):    S4 → S5 → S6

Feature 4 (Search):         S7 (độc lập)
```

Bốn feature **độc lập với nhau** — có thể develop song song.

### Complexity Summary

| Story | Feature | Complexity | Frontend-only? |
|-------|---------|------------|---------------|
| S1 | Store removeRoot | Trung bình | ✅ |
| S2 | Context menu UI | Thấp | ✅ |
| S3 | Move sidebar toggle | Rất thấp | ✅ |
| S4 | Preview emit scroll | Thấp | ✅ |
| S5 | Editor receive scroll | Thấp | ✅ |
| S6 | Wire two-way scroll | Trung bình | ✅ |
| S7 | CM search panel | Thấp | ✅ |

**Toàn bộ v1.3.0 bổ sung là frontend work** — không cần Rust command mới. `@codemirror/search` là package mới duy nhất cần cài.

### New Files (Expected)

```
(không có file mới)
```

### Modified Files (Expected)

```
src/stores/workspace.ts              (S1) — thêm removeRoot()
src/components/ExplorerPanel.vue     (S2) — context menu trên root header
src/components/AppHeader.vue         (S3) — move sidebar toggle button
src/components/PreviewPane.vue       (S4) — emit scroll percent từ preview
src/components/SourceEditor.vue      (S5, S7) — nhận scroll percent + search panel
src/components/EditorArea.vue        (S6) — wire two-way scroll
package.json                         (S7) — thêm @codemirror/search
```
