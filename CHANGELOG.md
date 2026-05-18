# Changelog

All notable changes to mdview.

## [1.2.0] — 2026-05-18

### Added

- **Multi terminal tabs** — Terminal Panel tab bar with "+" button to create additional PTY sessions. Each tab is an independent shell process with its own xterm.js buffer. Close a tab kills only that session; closing the last tab leaves the panel open but empty. Double-click a tab label to rename (max 30 chars, session-scoped, not persisted across restarts) (FR-32, FR-33).
- **In-app update UX** — Upgrades the v1.0.1 startup-check prompt to a full update flow: "Check for Updates" button in App Header triggers a manual check at any time; if an update is found, an Update Modal displays the release notes (markdown rendered, unsafe HTML stripped) and a download progress bar. After download: "Install & Restart" button. "Later" dismisses without blocking. Download failures show an inline retry option (FR-34, FR-35).

### Changed

- **Terminal Panel moved to a VSCode-style bottom panel** (was a sidebar view in v1.1.0). Spans the full width of the work area (sidebar + main); drag the top edge to resize (clamped 120–800px, persisted within session). Toggle with the Activity Bar Terminal icon or `Cmd/Ctrl+\``.
- **Activity Bar semantics** — Folders icon toggles the Sidebar; Terminal icon toggles the Bottom Panel. Each icon highlights when its panel is visible; panels are independent (Sidebar + Terminal can be open at the same time). The previous `activeView` model is removed from the `ui` store; `bottomPanelVisible` + `bottomPanelHeight` are now first-class state.
- Layout restructured to `[AppHeader] / [ActivityBar | (Sidebar | Main) over BottomPanel]` so the bottom panel sits under both the sidebar and the editor.

### Fixed

- **Terminal `cwd` race** — `TerminalPanel` now waits up to 2 s for `restoreWorkspace()` to finish before calling `pty_spawn`, so the PTY's working directory matches the first workspace root on cold start instead of falling back to `$HOME` when the user opens the panel quickly.
- **`.md` file association now actually opens files in mdview.** Previously the OS launched mdview but the file never reached the editor. Three open paths are now wired through to a `tabs.openFile` call:
  - cold launch with argv `.md` paths (Windows/Linux),
  - macOS `RunEvent::Opened { urls }` from Finder while the app is already running,
  - any-platform second-launch via `tauri-plugin-single-instance`.
  Paths are buffered in a Rust-side `PendingOpens` queue and live-emitted as an `open-file-request` event; the frontend drains the queue on mount and also subscribes to the event. The main window is focused/un-minimized on each open.

## [1.1.0] — 2026-05-18

### Added

- **Multi-root workspace via `.code-workspace`** — open VSCode-format workspace files (`{"folders":[{"path":"..."}]}`); roots render as independent top-level sections in the File Tree; relative folder paths resolve against the workspace file's directory; missing roots surface an inline warning instead of failing the load. JSONC comments are tolerated (FR-24, FR-25).
- **File management from the File Tree** — right-click any folder for "New File", right-click any `.md` file for Rename / Delete. Inline editable rows handle create + rename; Delete uses a native confirm and is permanent (no Trash). Open tabs follow rename and close automatically on delete (FR-23, FR-30, FR-31).
- **Activity Bar** — 48px left rail with Folders + Terminal icons (in v1.1.0 these switched between Explorer and Terminal *views* inside the Sidebar; reworked in v1.2.0) (FR-26).
- **Terminal Panel** — embedded `portable-pty` shell rendered with xterm.js. System shell auto-detected (`$SHELL` on Unix; `pwsh → powershell → cmd` on Windows). Working directory defaults to the first workspace root (or `$HOME`). Session survives view switches and is killed on app exit (FR-27, FR-28).
- **App Header** — global header bar hosts the Sidebar Toggle (left) and Theme Toggle (right); `Cmd/Ctrl+B` still toggles the sidebar (FR-29, FR-22).

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
