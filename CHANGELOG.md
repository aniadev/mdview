# Changelog

All notable changes to mdview.

## [1.1.0] — 2026-05-18

### Added

- **Multi-root workspace via `.code-workspace`** — open VSCode-format workspace files (`{"folders":[{"path":"..."}]}`); roots render as independent top-level sections in the File Tree; relative folder paths resolve against the workspace file's directory; missing roots surface an inline warning instead of failing the load. JSONC comments are tolerated (FR-24, FR-25).
- **File management from the File Tree** — right-click any folder for "New File", right-click any `.md` file for Rename / Delete. Inline editable rows handle create + rename; Delete uses a native confirm and is permanent (no Trash). Open tabs follow rename and close automatically on delete (FR-23, FR-30, FR-31).
- **Activity Bar** — 48px left rail with Folders + Terminal icons that toggle the Sidebar and the bottom Terminal Panel respectively. Active panels are highlighted; activity bar stays visible regardless of panel state (FR-26).
- **Terminal Panel** — VSCode-style bottom panel hosting an embedded `portable-pty` shell rendered with xterm.js. Drag the top edge to resize (120–800px, persisted within session). Toggle with the Activity Bar icon or `Cmd/Ctrl+\``. System shell auto-detected (`$SHELL` on Unix; `pwsh → powershell → cmd` on Windows). Working directory defaults to the first workspace root (or `$HOME`). Session survives panel toggles and is killed on app exit (FR-27, FR-28).
- **App Header** — global header bar now hosts the Sidebar Toggle (left) and Theme Toggle (right); `Cmd/Ctrl+B` still toggles the sidebar (FR-29, FR-22).

### Changed

- `palette` store now takes `rootPaths: string[]` and dedupes files across roots.
- `workspace` persistence supports both `workspace_path` (legacy single folder) and `workspace_file` (path to a `.code-workspace`); the latter wins on restore.

## [1.0.2] — 2026-05-18

### Added

- **Tab context menu** — right-click any tab header to Close the tab or Close All Tabs. The close-all action prompts if any open files have unsaved changes.
- **Preview pane theme toggle** — independent dark/light control for the preview pane (☀/☾ button in the preview toolbar), persisted separately from the editor theme. Affects syntax highlighting, Mermaid diagram theme, and browser-export HTML.
- **Sidebar toggle** — hide/show the primary sidebar via `Cmd/Ctrl+B` or the ◀/▶ button at the left edge of the tab bar. `Cmd+B` in the CodeMirror editor still performs bold formatting; sidebar toggle fires only when the editor is not focused.
- **Ubuntu/Linux build** — `pnpm tauri:build:linux` produces AppImage + `.deb` for x86\_64 Linux. See README for host prerequisites.

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
