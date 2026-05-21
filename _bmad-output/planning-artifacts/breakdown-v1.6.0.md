---
title: "mdview v1.6.0 — Feature Breakdown"
version: 1.6.0
created: 2026-05-20
status: planning
---

# v1.6.0 Feature Breakdown

Đợt nâng cấp toàn diện về mặt kỹ thuật giao diện (SCSS + Tailwind v4) cùng 3 tính năng mới đột phá trợ giúp đắc lực cho quy trình ghi chú, tra cứu tài liệu và quản lý tiến độ nhanh trên mdview.

---

## 0. TECHNICAL: Nâng cấp kiến trúc Style với SCSS

### 0.1 Phân tích gốc rễ
File style duy nhất hiện nay `src/styles/main.css` đang chứa toàn bộ cấu trúc định hình style của ứng dụng, kết hợp với hàng chục style scoped phức tạp trong các Single File Components (Vue SFC). 
* **Hạn chế:** Cú pháp CSS thuần không hỗ trợ lồng selector (Nesting), kế thừa biến màu phức tạp khó cấu trúc, không tách biệt được thành các module có tính năng rõ rệt (Mixins, Variables, Components).

### 0.2 Giải pháp & Bản thiết kế
Tích hợp package `sass` để biên dịch trực tiếp các style rules viết bằng cú pháp SCSS. Tách kiến trúc style thành nhiều file cấu phần độc lập:
1. `src/styles/_variables.scss`: Quản lý các mã màu hệ thống, phông chữ và cấu hình theme sáng/tối.
2. `src/styles/_mixins.scss`: Định nghĩa các hàm helper rút gọn layout (flexbox center, scrollbar ẩn, text truncation...).
3. `src/styles/main.scss`: File entry chính, import Tailwind CSS v4 base và tích hợp các module con.

### 0.3 Stories

#### S-S1 — Infrastructure: Cấu hình Sass compiler cho Vite
* **Goal:** Tương thích hóa build pipeline để nhận diện và biên dịch tệp `.scss`.
* **Scope:**
  - Cài đặt package `sass` dưới dạng devDependency.
  - Sửa đổi tham chiếu import tại `src/main.ts` từ `src/styles/main.css` sang `src/styles/main.scss`.
* **Complexity:** Thấp

#### S-S2 — Migration: Chuyển đổi & Modulize tệp CSS hiện tại
* **Goal:** Tách tệp main.css thành ba module scss chuyên dụng và tối ưu hóa cú pháp thông qua Nesting selectors.
* **Scope:**
  - Đổi tên tệp và tạo các file cấu trúc con: `_variables.scss`, `_mixins.scss`, `main.scss`.
  - Trích xuất các biến `--bg-app`, `--border`, `--accent` vào `_variables.scss`.
  - Khai báo lại các khối CSS lồng nhau (như `.sidebar-header .ws-name` chuyển về `.sidebar-header { .ws-name { ... } }`) nhằm thu gọn 30% số lượng dòng.
* **Complexity:** Trung bình

---

## 1. TECHNICAL: Porting toàn diện CSS sang Tailwind v4 Utility Class

### 1.1 Phân tích gốc rễ
Mặc dù Tailwind v4 đã được nhúng vào Vite, phần lớn CSS layout nội bộ và khoảng cách vẫn viết thủ công bằng class tùy chỉnh. Layout shell và margins không đồng đều, gây khó khăn cho việc đảm bảo tính thống nhất thị giác (Visual Consistency).

### 1.2 Giải pháp & Bản thiết kế
Porting triệt để tất cả custom component classes sang Tailwind utility classes tương ứng (`flex`, `grid`, `border-*`, `bg-*`, `text-*`).
Ánh xạ các css variable theme của mdview sang Tailwind's customized system colors thông qua `@theme` directive của phiên bản v4.

### 1.3 Stories

#### S-T1 — Cấu hình `@theme` Tailwind v4 trong SCSS
* **Goal:** Đồng bộ hệ màu sáng/tối hiện tại vào bảng màu mặc định của Tailwind.
* **Scope:**
  - Thêm config `@theme { ... }` vào đầu tệp `main.scss` map các key `sidebar`, `tab-bar`, `accent`, `border` với CSS variables tương ứng.
* **Complexity:** Thấp

#### S-T2 — Refactoring: Gỡ bỏ custom class trong Vue Components
* **Goal:** Tái cấu trúc templates và gỡ bỏ 80% scoped css không cần thiết, chuyển sang Tailwind utilities.
* **Scope:**
  - Thực hiện trên: `App.vue`, `ExplorerPanel.vue`, `TabBar.vue`, `TerminalTabBar.vue`.
  - Thay thế các đoạn code flexbox, spacing, rounded corners thủ công bằng Tailwind class trực quan.
* **Complexity:** Cao

---

## 2. FEATURE 1: Tương tác Checklist trực tiếp trên Preview (Interactive Preview Checklist)

### 2.1 Phân tích gốc rễ
Khi xem một tài liệu chứa checklist (`- [ ] task`), người dùng muốn đánh dấu hoàn thành nhanh bằng cách click chọn trực tiếp trên giao diện Preview mà không muốn mất thời gian tìm kiếm dòng chứa task đó trong mã nguồn Editor để gõ chữ `x` thủ công.

### 2.2 Giải pháp & Bản thiết kế
* Khi render Markdown thành DOM trên Preview, parser sẽ gán cho mỗi node checkbox một attribute định danh duy nhất (ví dụ: `data-checklist-idx="i"` ứng với checkbox thứ `i` xuất hiện từ trên xuống dưới trong tệp tin).
* Giao diện `PreviewPane.vue` lắng nghe sự kiện `change` trên các thẻ `input[type="checkbox"]`.
* Khi có checkbox thay đổi trạng thái, PreviewPane gửi một tín hiệu `toggle-checklist` kèm theo `index` lên `EditorArea.vue`.
* Editor nhận chỉ số index, quét nhanh qua CodeMirror document bằng thuật toán Regex để định vị checkbox thứ `i`, sau đó thực hiện một CodeMirror **Transaction** thay đổi `[ ]` sang `[x]` (hoặc ngược lại) một cách an toàn và sạch sẽ, giữ nguyên lịch sử Undo/Redo của người dùng.

### 2.3 Stories

#### S-IC1 — PreviewPane: Gán định danh index và Bắt sự kiện checkbox click
* **Goal:** Render checkbox kèm index và phát đi event tương thích.
* **Scope:**
  - Bổ sung markdown-it plugin hoặc post-process DOM để gán index `data-checklist-idx` cho từng checkbox input.
  - Thêm sự kiện lắng nghe click/change trên preview container. Lấy index và phát emit `toggle-checklist` kèm state (checked/unchecked).
* **Complexity:** Trung bình

#### S-IC2 — EditorArea & CodeMirror: Đồng bộ thay đổi nội dung văn bản
* **Goal:** Định vị và thay đổi text tương ứng trong Editor qua transaction.
* **Scope:**
  - Lắng nghe event `toggle-checklist`.
  - Sử dụng CodeMirror transaction để thay đổi ký tự tại dòng khớp với checkbox thứ `i`.
  - Kích hoạt cơ chế tự động lưu file (Auto-save) sau sự kiện gõ.
* **Complexity:** Trung bình

---

## 3. FEATURE 2: Tìm kiếm toàn văn trong Workspace (Global Workspace Search)

### 3.1 Phân tích gốc rễ
mdview hiện tại chỉ có Command Palette tìm kiếm theo *tên tệp*, chưa hỗ trợ quét tìm kiếm *nội dung bên trong* các tệp ở toàn bộ workspace. Người dùng khó có thể tra cứu và liên kết kiến thức giữa nhiều tệp ghi chú khác nhau.

### 3.2 Giải pháp & Bản thiết kế
* **Rust Backend:** Xây dựng command `search_workspace(query: String)`. Dùng cơ chế multi-thread duyệt qua các thư mục con của workspace (chỉ quét các tệp `.md`). Định vị dòng chứa từ khóa khớp regex, trả về một danh sách kết quả chứa: Đường dẫn tệp, số dòng thứ n, nội dung dòng bị bắt từ khóa để làm snippet.
* **Frontend UI:** 
  - Tạo thêm một tab phụ "Search" trong Sidebar bên cạnh tab "Explorer" và "Outline".
  - Chứa ô nhập từ khóa tìm kiếm (Search bar), hỗ trợ phím nóng mở nhanh `Cmd/Ctrl+Shift+F`.
  - Hiển thị danh sách kết quả dạng cây (gom nhóm theo tệp). Snippet tìm kiếm highlight từ khóa.
  - Khi click vào một snippet kết quả, tự động mở tệp đó, scroll editor đến đúng số dòng và highlight tiêu điểm.

### 3.3 Stories

#### S-GS1 — Rust: Bổ sung Rust Command `search_workspace`
* **Goal:** Quét toàn bộ tệp `.md` trong workspace và lọc ra các kết quả chứa query.
* **Scope:**
  - Viết `search_workspace(query, workspace_roots: Vec<String>)` trong Rust.
  - Lọc bỏ các thư mục ẩn (`.git`, `node_modules`).
  - Đăng ký command vào `invoke_handler` và tệp capabilities.
* **Complexity:** Trung bình

#### S-GS2 — Sidebar UI: Tạo giao diện Tab Tìm Kiếm & Sidebar Picker
* **Goal:** Tích hợp giao diện Tìm kiếm toàn văn trực quan gọn gàng trên sidebar.
* **Scope:**
  - Thêm tab "Search" vào `.sidebar-activity-row` cùng icon `lucide:search`.
  - Tạo UI nhập từ khóa, nút trigger Clear, input loading state.
  - Hiển thị danh sách tệp đính kèm số dòng tương ứng.
* **Complexity:** Trung bình

#### S-GS3 — Navigation: Mở file và cuốn view đến dòng chứa từ khóa
* **Goal:** Click kết quả tìm kiếm tự động chọn, hiển thị và track dòng tương ứng.
* **Scope:**
  - Bắt sự kiện click kết quả. Gọi mở file thông qua `workspaceStore`/`tabsStore`.
  - Truyền tham số dòng mục tiêu (`targetLine`) đến `SourceEditor.vue`.
  - Sử dụng phương thức `editorView.dispatch({ effects: ... })` để scroll dòng đó ra điểm giữa màn hình và chớp highlight.
* **Complexity:** Trung bình

---

## 4. FEATURE 3: Ghi Nhật ký Nhanh (Daily Notes & Journaling)

### 4.1 Phân tích gốc rễ
Quy trình ghi nhật ký hàng ngày (Daily log/Journal) thường đòi hỏi tạo file mới, đặt tên theo ngày, gõ heading tiêu đề ngày. Tính năng Daily Notes tự động hóa toàn bộ việc này chỉ với một Click duy nhất.

### 4.2 Giải pháp & Bản thiết kế
* Thêm nút Daily Notes chuyên dụng trên thanh TabBar (hoặc sidebar action) với icon `lucide:calendar-days`. Hỗ trợ phím tắt nóng toàn cục `Alt+D`.
* Người dùng cấu hình Thư mục lưu nhật ký trong Settings (ví dụ: `documents/journals/`). Nếu không thiết lập, mặc định tạo ở thư mục root đầu tiên của workspace.
* Khi nhấn nút kích hoạt:
  * Lấy ngày hiện tại tạo chuỗi định danh `YYYY-MM-DD`.
  * Kiểm tra tệp tin `YYYY-MM-DD.md` đã hiện hữu trong thư mục chỉ định chưa.
  * Nếu chưa: Tự động chạy lệnh tạo tệp mới với template tiêu chuẩn sơ bộ (ví dụ: `# Nhật ký Ngày YYYY-MM-DD \n\n- Write here...`).
  * Nếu rồi: Mở trực tiếp tệp này trên tab soạn thảo, di chuyển con trỏ chuột xuống dòng cuối cùng để sẵn sàng viết nhật ký.

### 4.3 Stories

#### S-DN1 — Settings: Cấu hình thư mục lưu trữ Daily Notes
* **Goal:** Cho phép đặt thư mục đích lưu trữ nhật ký cá nhẫn dễ dàng.
* **Scope:**
  - Thêm trường cấu hình "Daily Notes Folder Path" trong `SettingsModal.vue`.
  - Lưu cấu hình vào `mdview-settings.json` thông qua Tauri plugin store.
* **Complexity:** Thấp

#### S-DN2 — Core Logic: Tự động khởi tạo và Mở tệp nhật ký hàng ngày
* **Goal:** Giải quyết flow lấy ngày giờ hệ thống gộp tên file, kiểm tra tồn tại và focus soạn thảo.
* **Scope:**
  - Thêm method `openDailyNote()` vào `workspace` store.
  - Chạy cơ chế tìm tệp, gọi Rust backend kiểm tra `path_exists`.
  - Tạo file mới với nội dung tiêu biểu nếu chưa xuất hiện trên ổ đĩa.
  - Wire phím tắt `Alt+D` ở window level để trigger nhanh flow này.
* **Complexity:** Trung bình

---

## 5. Tổng hợp Kế hoạch Triển khai v1.6.0

### Dependency Graph

```
                   ┌──> S-S1 ──> S-S2 (SCSS Modulization)
                   │
Build Pipeline ────┼──> S-T1 ──> S-T2 (Tailwind Porting)
                   │
                   ├──> S-IC1 ──> S-IC2 (Interactive Checklist)
                   │
                   ├──> S-GS1 ──> S-GS2 ──> S-GS3 (Global Workspace Search)
                   │
                   └──> S-DN1 ──> S-DN2 (Daily Notes Setup)
```

### Complexity & Impact Matrix

| Story | Feature | Complexity | Front-end Only? |
|-------|---------|------------|-----------------|
| S-S1 | Vite Sass Compiler Setup | Thấp | ✅ |
| S-S2 | CSS sang SCSS Modulization | Trung bình | ✅ |
| S-T1 | Tái định nghĩa Tailwind v4 Theme | Thấp | ✅ |
| S-T2 | Porting Tailwind Utility Classes trong Vue Components | Cao | ✅ |
| S-IC1| Highlight & bắt thay đổi checkbox Preview | Trung bình | ✅ |
| S-IC2| Dispatch CM6 Transaction đổi text file | Trung bình | ✅ |
| S-GS1| Rust `search_workspace` command | Trung bình | ❌ (Rust) |
| S-GS2| Giao diện Tab Search & Kết quả hiển thị | Trung bình | ✅ |
| S-GS3| Điều hướng click & scroll editor | Trung bình | ✅ |
| S-DN1| Settings Daily Notes preferences | Thấp | ✅ |
| S-DN2| Tạo file daily note, phím tắt Alt+D, auto-focus | Trung bình | ✅ |

### New Files Expected

```
src/styles/main.scss
src/styles/_variables.scss
src/styles/_mixins.scss
src/components/SearchPanel.vue    (S-GS2) - Giao diện tìm kiếm toàn văn
src/i18n/ (thêm các nhãn dịch cho Search và Daily Note)
```

### Modified Files Expected

```
package.json
src/main.ts
src/App.vue
src/stores/workspace.ts
src/stores/ui.ts
src/components/SettingsModal.vue
src/components/PreviewPane.vue
src/components/SourceEditor.vue
src/components/EditorArea.vue
src-tauri/src/lib.rs
src-tauri/capabilities/default.json
```
