# Changelog

All notable changes to mdview.

## [1.0.1] — 2026-05-18

### Fixed

- Preview: relative image paths starting with `./` (e.g. `![](./public/img.png)`) now render. Path normalization resolves `.` and `..` segments before passing to the Tauri asset protocol.

### Added

- Asset protocol enabled (`app.security.assetProtocol`) so local images load in Preview.
- Auto-updater: app checks for new releases on startup via `tauri-plugin-updater`, prompts user to install signed updates from the GitHub Releases `latest.json` endpoint.

### Infrastructure

- Release workflow now signs `latest.json` using `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` GitHub secrets, enabling verified updates from v1.0.1 onward.
- macOS bundles now ad-hoc signed (`APPLE_SIGNING_IDENTITY=-`) — reduces Gatekeeper "damaged" rejection. First-launch still requires **System Settings → Privacy & Security → Open Anyway**, or `xattr -dr com.apple.quarantine /Applications/mdview.app`. Full Apple notarization deferred until Developer Program available.

## [1.0.0] — 2026-05-18

Initial public release.

### Added

- Workspace: add / remove single folder, persisted across sessions (FR-1, FR-2, FR-3)
- File Tree: full structure, expand/collapse, dim folders without `.md` (FR-4, FR-5, FR-6)
- Tabs: multi-file editing, active highlight, X close, dirty indicator, close-confirm on unsaved (FR-7, FR-8, FR-9)
- Manual save with `Cmd/Ctrl+S` (FR-10)
- Split-pane editor: CodeMirror 6 source + GFM preview, draggable divider, percentage scroll sync (FR-11, FR-12, FR-13, FR-14)
- Command Palette `Cmd/Ctrl+P`: fuzzy match `.md` filenames, max 20 results (FR-15, FR-16, FR-17)
- Math rendering via KaTeX, inline `$…$` and block `$$…$$` (FR-18)
- Mermaid diagrams via fenced ```` ```mermaid ```` blocks, lazy-loaded (FR-19)
- Editor toolbar: Bold, Italic, Heading cycle, Underline, Strikethrough, ordered/unordered/check lists, Quote, Code block, Table, Link, Image (FR-20)
- Open Preview in Browser: export rendered HTML snapshot to OS temp folder, open via system browser (FR-21)
- Theme switch: dark (default) ↔ light, persisted (FR-22)
- Cross-platform: macOS 12+ (Apple Silicon + Intel) and Windows 10/11
- File association: registered as editor for `.md` and `.markdown`

### Non-functional

- Bundle target: < 20MB installer (NFR-5)
- Cold start: < 2s on baseline hardware (NFR-1)
- Preview render: < 200ms after 150ms debounce on files ≤ 500KB (NFR-3)
- Zero-config — no setup wizard, no account (NFR-8)
- VSCode-style spatial model (NFR-9)
