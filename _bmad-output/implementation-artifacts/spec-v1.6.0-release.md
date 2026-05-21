---
title: 'mdview v1.6.0 — Release Upgrade Spec'
type: 'feature'
created: '2026-05-20'
status: 'in-progress'
baseline_commit: 'd1dc08f754e8076aaf8a6a787aed9f459e03584b'
context: []
---

<frozen-after-approval reason="Anh em chốt phạm vi tích hợp giao diện SCSS và các tính năng mới">

## Intent

**Problem:** mdview cần nâng cấp tính thẩm mỹ & cấu trúc giao diện thông qua SCSS + Tailwind v4 theme, bổ sung tính năng đồng bộ Checklist trên Preview, tìm kiếm toàn văn trong Workspace, và tạo ghi nhật ký hàng ngày (Daily Notes) để tối ưu hoá trải nghiệm người dùng.

**Approach:** 
- Porting toàn bộ CSS tĩnh sang SCSS Modules kết nối Tailwind v4 `@theme`.
- Triển khai Checklist tương tác hai chiều (Preview check -> Editor CM6 Text transaction).
- Viết Rust command Concurrent Search toàn bộ file `.md` trong Workspace và xây dựng Sidebar Search Panel điều hướng chuẩn xác dòng kết quả.
- Tích hợp Alt+D và Settings cấu nhập/mở Daily Notes tự động.

## Boundaries & Constraints

**Always:**
- Tương thích đa nền tảng (Windows/macOS/Linux), xử lý chuẩn hoá dấu xoẹt ngang (`/` và `\`).
- Thay đổi văn bản trong CodeMirror phải chạy qua transaction để không làm gãy tính năng Undo/Redo.
- Search phải chạy đa luồng trên Rust (Multi-threading) và loại bỏ thư mục ẩn bọc trong `.git` hay `node_modules`.

**Ask First:**
- Mặc định khởi tạo tệp nhật ký hàng ngày bằng tiếng Việt hay tiếng Anh tùy thuộc vào locale hiện tại của hệ thống.

**Never:**
- Không sử dụng thư viện bên ngoài để thực hiện thao tác regex search trên Rust ngoại trừ thư viện std.
- Không phá vỡ kiến trúc shell-latch PTY của panel terminal dưới đáy màn hình.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Checklist Click | Click checkbox thứ 2 trong preview | Phóng event toggle checklist index 1 lên editor, thay đổi chỉ mục checkbox tương ứng thành `[x]` | Bỏ qua nếu dòng không khớp regex |
| Global Search | Nhập từ khóa "Tauri" | Rust concurrent scan trả về danh sách Match, UI Sidebar nhóm kết quả theo file và bôi đậm keyword | N/A |
| Open Match | Click dòng 15 của file file.md | Editor mở file.md, cuốn tới dòng 15, trỏ focus và chọn (select) text của dòng đó để highlight | N/A |
| Daily Notes | Nhấn Alt+D chưa cấu hình folder | Tạo file `YYYY-MM-DD.md` ngay bên dưới thư mục root đầu tiên của Workspace đang mở | Báo lỗi banner nếu không có workspace nào được mở |

</frozen-after-approval>

## Code Map

- `src-tauri/src/lib.rs` -- Đăng ký Rust commands `search_workspace`
- `src/stores/workspace.ts` -- Chứa action `openDailyNote`
- `src/stores/ui.ts` -- Bổ sung SidebarView "search" và trạng thái targetLine
- `src/components/SearchPanel.vue` -- Giao diện Tìm kiếm toàn văn
- `src/components/SettingsModal.vue` -- Cấu hình thư mục Daily note
- `src/components/PreviewPane.vue` -- Xử lý index Checklist click trigger
- `src/components/SourceEditor.vue` -- Nhận targetLine cuốn view & highlight
- `src/components/EditorArea.vue` -- Cầu nối event checklist & search target line

## Tasks & Acceptance

**Execution:**
- [ ] `src/styles/main.scss` -- Tổ chức lại file style chính nhập Tailwind + variables + mixins
- [ ] `src/styles/_variables.scss` -- Khai báo hệ tông màu
- [ ] `src/styles/_mixins.scss` -- Khai báo các mixins gom gọn layout helper
- [ ] `src-tauri/src/lib.rs` -- Viết command `search_workspace` đa luồng, loại bỏ thư mục ẩn
- [ ] `src/stores/ui.ts` -- Bổ sung state `sidebarView: 'search'` và `targetLine`
- [ ] `src/components/SearchPanel.vue` -- Viết component tìm kiếm tree-view highlight kết quả
- [ ] `src/components/ExplorerPanel.vue` -- Thêm button tab Search vào Activity row
- [ ] `src/components/PreviewPane.vue` -- Post-process inject data-checklist-idx và emit toggle event
- [ ] `src/components/SourceEditor.vue` -- Nhận toggle checklist sửa text qua transaction, xem targetLine scroll + select highlight.
- [ ] `src/components/SettingsModal.vue` -- Thêm mục cấu hình folder Daily Notes
- [ ] `src/stores/workspace.ts` -- Viết action `openDailyNote` sinh YYYY-MM-DD.md
- [ ] `src/App.vue` -- Gắn phím nóng Alt+D mở Daily note

**Acceptance Criteria:**
- Given Workspace được mở, khi gõ Alt+D, then file nhật ký `YYYY-MM-DD.md` được tạo và mở tự động.
- Given Preview hiển thị danh sách checklist, khi click vào checkbox cụ thể, then editor lập cập cập nhập văn bản tương thích.

## Spec Change Log

*(Trống)*

## Design Notes

Tìm kiếm cascaded và scroll ngắm tiêu điểm:
```typescript
// SourceEditor.vue
watch(() => props.targetLine, (lineNum) => {
  if (lineNum && view) {
    const line = view.state.doc.line(lineNum);
    view.dispatch({
      selection: { anchor: line.from, head: line.to },
      effects: [EditorView.scrollIntoView(line.from, { y: 'center' })]
    });
    view.focus();
  }
});
```

## Verification

**Commands:**
- `pnpm typecheck` -- Kiểm tra kiểu TypeScript
- `cargo check --manifest-path src-tauri/Cargo.toml` -- Kiểm tra biên dịch Rust
