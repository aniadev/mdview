---
title: "mdview — Markdown Workspace Editor"
status: final
created: 2026-05-18
updated: 2026-05-18
---

# Product Brief: mdview

## Executive Summary

mdview là desktop app dành cho developer và writer làm việc với markdown trong các folder dự án. Ứng dụng mang lại trải nghiệm workspace-focused: mở folder, thấy ngay cấu trúc file, edit và preview markdown song song — tất cả trong một giao diện quen thuộc như VSCode nhưng tối giản và chuyên biệt hơn.

Các tool hiện tại đều thiếu một thứ: VSCode không có built-in markdown workspace mode — file tree lẫn lộn, preview cần extension; Obsidian thiên về knowledge graph, nặng và opinionated; Typora không quản lý folder. mdview lấp đúng khoảng trống đó — nhẹ, nhanh, đúng việc.

Build bằng Tauri, chạy native trên Mac và Windows. Side project mở rộng thành public release.

## Vấn đề

Developer và writer thường có folder dự án chứa hỗn hợp nhiều loại file. Khi cần làm việc với documentation hoặc notes dưới dạng markdown, họ phải chọn giữa:

- **VSCode**: mạnh nhưng không có chế độ workspace tập trung vào `.md` — file tree lẫn lộn, preview cần cài extension riêng
- **Obsidian**: vault-based, import cả folder nhưng giao diện graph-centric làm phân tán khi chỉ cần edit documentation
- **Typora**: preview đẹp nhưng không có folder/workspace management

Kết quả: người dùng mở nhiều cửa sổ, mất context, hoặc chấp nhận UX không phù hợp.

## Giải pháp

mdview cho phép người dùng **add folder dự án** như một workspace. Sidebar hiển thị toàn bộ cấu trúc folder — các folder không chứa `.md` file được giảm opacity, giảm visual clutter mà không ẩn context dự án.

Mỗi file `.md` mở trong **tab editor** với layout **split-pane**: bên trái là source editor, bên phải là rendered preview đồng bộ real-time. Dark theme mặc định. Giao diện quen thuộc với bất kỳ ai đã dùng VSCode.

## Người dùng

**Primary:** Developer quản lý documentation, README, changelogs trong folder dự án. Quen dùng VSCode, muốn tool chuyên biệt hơn cho markdown mà không cần setup extension.

**Secondary:** Technical writer, content creator làm việc với markdown trong cấu trúc folder có tổ chức.

Thành công với user: mở folder → thấy file .md → edit và preview ngay — không cần config, không cần plugin.

## Điểm khác biệt

| Tiêu chí | mdview | VSCode | Obsidian | Typora |
|---|---|---|---|---|
| Workspace folder | ✅ | ✅ | Vault riêng | ❌ |
| Focus .md (dim non-md) | ✅ | ❌ | ẩn hết | ❌ |
| Split-pane editor | ✅ | Extension | ❌ | ❌ |
| Native performance | ✅ Tauri | Electron | Electron | Native |
| Bundle size | ~10MB | ~300MB | ~200MB | ~80MB |

Lợi thế cốt lõi: **workspace context + markdown focus** trong một app nhẹ, native. Không fabricate moat — execution speed và simplicity là thế mạnh thực sự.

## Tiêu chí thành công

### Acceptance criteria v1

- Mở và hiển thị folder với full file tree trong < 1 giây
- Dim visual hoạt động đúng: folder không chứa `.md` giảm opacity rõ ràng
- Split-pane sync real-time không lag với file ≤ 500KB
- Chạy ổn định trên Mac (Apple Silicon + Intel) và Windows 10/11
- Bundle size < 20MB

### Dấu hiệu adoption

- GitHub stars và download count từ release
- Issue reports chứng minh người dùng thực sự dùng ngoài tác giả

## Scope v1

### Trong scope

- Add / remove folder workspace
- Sidebar file tree: full structure, dim non-.md folders
- Tab-based editor (nhiều file mở cùng lúc)
- Command Palette (Cmd+P / Ctrl+P) — mở nhanh file theo tên
- Split-pane: source editor + rendered preview
- Dark theme mặc định
- Cross-platform: Mac + Windows

### Ngoài scope v1

- Export PDF / HTML
- Git integration
- Custom themes
- Full-text search trong nội dung files
- Image paste / embed

## Vision

Nếu mdview thành công, nó trở thành desktop editor dành riêng cho markdown workflow trong project folders — nhẹ hơn Electron alternatives và không ôm đồm tính năng knowledge-base. Có thể mở rộng: full-text search, export, Git diff view cho `.md` — nhưng luôn giữ scope: markdown editing trong project folders, không graph, không vault.
