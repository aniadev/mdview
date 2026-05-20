---
title: 'Multi-select files + bulk copy/cut/paste + toast + Cmd+J shortcut'
type: 'feature'
created: '2026-05-20'
status: 'done'
baseline_commit: 'f5960716a6bcddc0dc78ca76787d564c83209afa'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Explorer chỉ copy/cut/paste từng file một qua context menu — không thể chọn nhiều file và thao tác bulk. Cmd+C không có phản hồi gì. Không có shortcut Cmd+J để toggle bottom panel.

**Approach:** Thêm multi-select (Cmd+Click), đổi clipboard thành mảng paths, bắt Cmd+C khi có selection để copy tất cả và hiện toast "Copied N file(s)". Paste loop qua toàn bộ mảng, tiếp tục khi gặp lỗi từng file. Thêm Cmd+J = toggle bottom panel song song với Cmd+`.

## Boundaries & Constraints

**Always:**
- Cmd+Click toggles selection, không mở file.
- Click thường = mở file (behavior cũ giữ nguyên) + set selection = [path đó].
- Cmd+C chỉ kích hoạt khi `selectedPaths.size > 0` và focus không ở input/textarea.
- Context menu right-click trên item đang được chọn (in selectedPaths) → áp dụng cho tất cả selected. Right-click item không selected → chỉ item đó (backward compat).
- Toast dùng chung `ui.showToast()` — không tạo toast riêng cho feature này.
- Cut chỉ hỗ trợ files, không hỗ trợ folder (giữ nguyên constraint cũ).

**Always:**
- Multi-paste lỗi từng file → log `workspace.error`, tiếp tục paste các file còn lại.
- Cmd+J toggle bottom panel, không xung đột với Cmd+` (giữ cả hai).

**Never:**
- Không thêm drag-select hay shift-click range.
- Không thêm checkbox UI — selection chỉ qua Cmd+Click.
- Không thay đổi Rust backend (copy_path đã đủ, gọi nhiều lần).
- Không thêm thư viện mới.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cmd+Click file | selectedPaths rỗng | path thêm vào selectedPaths, file không mở | — |
| Cmd+Click file đã chọn | path có trong selectedPaths | path bị bỏ khỏi selectedPaths | — |
| Click thường file | selectedPaths bất kỳ | file mở, selectedPaths reset = [path này] | — |
| Cmd+C khi 3 files chọn | selectedPaths = [a, b, c] | clipSources = [a,b,c], op='copy', toast "Copied 3 file(s)" | — |
| Paste 3 files vào dir | clipSources=[a,b,c], op='copy' | 3 files copy, clearClipboard | Lỗi từng file → workspace.error, tiếp tục |
| Right-click file đang selected (cùng 2 file khác) | ctxTarget in selectedPaths | Copy/Cut áp dụng cho cả 3 | — |
| Right-click file không selected | ctxTarget không in selectedPaths | Copy/Cut chỉ ctxTarget (single) | — |

</frozen-after-approval>

## Code Map

- `src/stores/fsui.ts` -- clipboard state + selection state
- `src/stores/ui.ts` -- toast system
- `src/components/FileTreeNode.vue` -- Cmd+Click handler, visual highlight khi multi-selected
- `src/components/ExplorerPanel.vue` -- Cmd+C keydown listener, ctxCopy/ctxCut/ctxPaste multi
- `src/App.vue` -- render toast từ ui store; Cmd+J shortcut

## Tasks & Acceptance

**Execution:**
- [x] `src/stores/fsui.ts` -- đổi `clipSource: string | null` → `clipSources: string[]`; đổi `clipIsDir: boolean` → `clipIsDirs: boolean[]`; thêm `selectedPaths: ref<Set<string>>(new Set())`; thêm `toggleSelection(path)`, `clearSelection()`, `isMultiSelected(path): boolean`, `selectedCount: computed`; cập nhật `setClipboard` thành `setClipboardMulti(paths, isDirs, op)` và giữ `setClipboard(path, isDir, op)` wrap sang multi; cập nhật `hasClipboard` check `clipSources.length > 0`; export tất cả ref/computed/functions mới -- clipboard và selection là core state, phải ở store
- [x] `src/stores/ui.ts` -- thêm `toastMessage: ref<string | null>(null)`; thêm `showToast(msg: string, ms = 2200)` set toastMessage rồi setTimeout clearSomit; export cả hai -- toast cần dùng từ nhiều nơi
- [x] `src/App.vue` -- thêm `<div v-if="ui.toastMessage" class="app-toast">{{ ui.toastMessage }}</div>` vào template (ngoài updater toast); thêm CSS `.app-toast` fixed bottom-center, fade-in/out, z-index cao -- hiển thị toast Cmd+C và các ops khác
- [x] `src/components/FileTreeNode.vue` -- sửa `onRowClick(e: MouseEvent)`: nếu `e.metaKey || e.ctrlKey` → `fsui.toggleSelection(props.node.path)` và return (không mở file); click thường → `fsui.clearSelection(); fsui.selectedPaths.add(props.node.path)` rồi mở file như cũ; thêm computed `isMultiSelected = computed(() => fsui.selectedPaths.has(props.node.path))`; thêm class `multi-selected` vào row khi true; thêm CSS `.tree-row.multi-selected` highlight (background accent màu khác `selected`) -- visual feedback cho selection
- [x] `src/components/ExplorerPanel.vue` -- thêm keydown listener trên panel div (tabindex="-1") bắt `Cmd+C`/`Ctrl+C` khi `fsui.selectedCount > 0` và `!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)`: gọi `setClipboardMulti([...fsui.selectedPaths], ...)` + `ui.showToast('Copied N file(s)')`; sửa `ctxCopy()`: nếu `ctxTarget in fsui.selectedPaths` → copy all selected (multi), else single; sửa `ctxCut()`: tương tự nhưng chỉ files; sửa `ctxPaste(targetDir)`: loop `fsui.clipSources` gọi `workspace.copyFile`/`moveFile` từng cái, lỗi từng item → set `workspace.error` rồi `continue` -- tập trung hết logic clipboard ở đây
- [x] `src/App.vue` -- trong `onKeydown`, thêm `else if (key === 'j') { e.preventDefault(); ui.toggleBottomPanel(); }` sau block Cmd+` -- Cmd+J là alias cho Cmd+` để toggle bottom panel

## Acceptance Criteria

- Given 3 files selected, when Cmd+C pressed, then `clipSources` có 3 paths và toast hiện "Copied 3 file(s)"
- Given `clipSources` = 2 files, when Paste vào folder, then 2 files được copy vào folder đó
- Given file đang chọn, when Cmd+Click lần 2, then file bị deselect
- Given click thường lên file mới, when any selectedPaths tồn tại, then selectedPaths reset và chỉ còn file mới
- Given right-click file không trong selection, when chọn Copy, then chỉ 1 file đó vào clipboard
- Given right-click file trong selection (cùng 2 file khác), when chọn Copy, then cả 3 file vào clipboard
- Given bottom panel ẩn, when Cmd+J pressed, then bottom panel hiện
- Given Paste 3 files, when file thứ 2 lỗi, then file 1 và 3 vẫn được copy, workspace.error ghi nhận lỗi file 2

## Design Notes

**`setClipboard` backward compat:** giữ signature cũ `setClipboard(path, isDir, op)` như wrapper gọi `setClipboardMulti([path], [isDir], op)` — các call site khác không cần sửa.

**`isDirs` per-path:** paste cần biết từng source có phải dir không để gọi đúng Rust logic. Mảng `clipIsDirs: boolean[]` index-aligned với `clipSources`.

**Keyboard event:** attach `@keydown` trên `.explorer-panel` div với `tabindex="-1"` để panel nhận focus khi click vào tree. Hoặc dùng `window.addEventListener('keydown', handler)` với guard `fsui.selectedCount > 0` — chọn window-level để Cmd+C hoạt động ngay cả khi panel không focus.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors

**Manual checks (if no CLI):**
- Cmd+Click 3 files → highlight multi-selected, Cmd+C → toast "Copied 3 file(s)"
- Paste vào folder → 3 files xuất hiện
- Click thường file sau khi multi-select → selection reset về 1
- Right-click file not in selection → Copy chỉ 1 file
- Cmd+J → toggle bottom panel (same as Cmd+`)
