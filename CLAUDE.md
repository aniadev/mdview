# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm install
pnpm tauri:dev            # full app (Vite + Rust) — the only way to exercise Tauri commands
pnpm dev                  # frontend only (no Tauri APIs available — `invoke()` will fail)
pnpm typecheck            # vue-tsc --noEmit (also runs as part of `build`)
pnpm build                # typecheck + vite build → dist/ (used by `tauri build`)
pnpm tauri:build:mac-universal   # x86_64 + arm64 .app + .dmg
pnpm tauri:build:win             # NSIS + MSI (needs Windows host)
pnpm icons                # regenerate src-tauri/icons/ from public/mdview.png
```

No test runner is configured. Quality gates = `pnpm typecheck` + `cargo check` / `cargo clippy` inside `src-tauri/` (the CI workflow runs both).

Release: tag `v*` and push — `.github/workflows/release.yml` matrix-builds macOS-universal + Windows x64/arm64 via `tauri-apps/tauri-action` into a draft GitHub Release. The updater endpoint (`tauri.conf.json` → `plugins.updater.endpoints`) reads `latest.json` from that release.

## Architecture

Two-process app: Vue 3 frontend in `src/` talks to a Rust Tauri 2 backend in `src-tauri/src/lib.rs` via `invoke()`. Vite serves the frontend on port 1420 (hard-coded — must be free).

### Rust commands (`src-tauri/src/lib.rs`)

All FS access is brokered through these — the frontend never uses `@tauri-apps/plugin-fs` directly for app data:

- `list_dir(path)` — single-level directory listing; `has_md` is computed via a **recursive** `WalkDir` so directories without any `.md` descendant can be dimmed in the sidebar. Hidden entries (`.`-prefixed) are skipped at every level.
- `list_md_files(root)` — flat recursive list of all `.md` files, used by the command palette (called once per root and deduped in the frontend store).
- `read_text` / `write_text` — UTF-8 file IO.
- `path_exists` — used to validate a restored workspace path on startup.
- `write_temp_html(html, base_name)` — writes a self-contained HTML snapshot to the OS temp dir; the frontend then calls `openPath` (opener plugin) to launch it in the system browser. Filename is sanitized (alphanumeric + `-_` only) and timestamped.
- `create_md_file(dir, filename)` / `rename_path(from, to)` / `delete_file(path)` — file management used by the Explorer context menu (v1.1). `create_md_file` auto-appends `.md` if missing and rejects duplicates; `delete_file` refuses directories.
- `parse_code_workspace(path)` — reads a VSCode-style `.code-workspace` JSON(C) file, returns the resolved `folders[]` (relative paths resolved against the file's parent). Comments and `/* */` blocks are stripped before JSON parse.
- `pty_spawn / pty_write / pty_resize / pty_kill` — basic PTY for the embedded Terminal Panel (v1.1). Backed by `portable-pty`. Output streams to the frontend as `pty-data` Tauri events `{ id, data }`; process exit fires `pty-exit { id }`. Shell auto-detected (`$SHELL` on Unix, `pwsh → powershell → cmd` on Windows). Sessions are tracked in a `PtyStore` `Manager` state.
- `consume_pending_open_files()` — drains the `PendingOpens` queue. Populated on cold-launch (argv `.md` paths), `RunEvent::Opened` from macOS Finder, and the `tauri-plugin-single-instance` callback. The frontend calls it once on mount and also listens for live `open-file-request` events for the hot path.

When adding a Rust command: register it in the `invoke_handler![]` macro at the bottom of `lib.rs` **and** add any new permission to `src-tauri/capabilities/default.json`. The current capability grants `fs:scope` for `$HOME/**`, `/tmp/**`, and `/Volumes/**`.

### Frontend state (Pinia stores in `src/stores/`)

- `workspace` — one or more root folders (v1.1 multi-root). Two persistence keys: `workspace_path` (single folder, legacy) and `workspace_file` (path to a `.code-workspace`). `restoreWorkspace()` prefers the workspace file, falls back to the legacy single path, and validates each. The tree is lazy: per-root level loaded; `toggleDir()` populates children on first expand. Exposes `createMdFile / renameMdFile / deleteMdFile` which call the Rust commands and refresh the right slice of the tree, plus `rootPaths` (array) used by the palette and `rootPath` (first root, kept for compatibility).
- `tabs` — open files. Dirty = `content !== savedContent`. `closeTab` confirms via Tauri's native dialog when dirty. `openFile` is idempotent (existing tab is just re-activated). `handleFileRenamed/Deleted` are called by the Explorer after the FS op so tabs follow the file or close silently.
- `palette` — `Cmd/Ctrl+P` fuzzy file picker. Takes `rootPaths: string[]`; refreshes by listing each root via `list_md_files` and deduping.
- `theme` — `dark` (default) / `light`, persisted in the same store file. Toggling re-initializes Mermaid and swaps the highlight.js stylesheet.
- `ui` — `sidebarVisible`, `bottomPanelVisible`, `bottomPanelHeight` (clamped 120–800). Activity Bar icons call `toggleSidebar` / `toggleBottomPanel` directly; `Cmd/Ctrl+B` toggles the sidebar, `Cmd/Ctrl+\`` toggles the bottom Terminal panel.
- `fsui` — Explorer UI state (shared context menu position/target, plus `pendingCreateInDir` / `pendingRenamePath`) so the inline `InlineFilenameInput` can render in the right tree node.
- `terminal` *(v1.2)* — multi-session state for the Terminal Panel: `sessions: TerminalSession[]` (each `{ uid, ptyId, label, customLabel }`), `activeUid`, and `createSession / closeSession / switchTo / rename / setPtyId`. `uid` is a frontend-only monotonic id used as the Vue `key`; `ptyId` is the backend PTY id assigned after `pty_spawn` returns. `TerminalPanel` mounts one `TerminalView` per session (each owns its own xterm + listens to `pty-data` filtered by `ptyId`) and uses `v-show` so closed-but-inactive tabs keep their PTY + xterm buffer alive. Closing the last tab leaves the panel empty by design — don't add auto-recreate on `sessions.length === 0`.
- `updater` *(v1.2)* — drives the custom `UpdateModal`. State machine: `idle → checking → available | no-update | error`, then `available → downloading → ready`. `checkForUpdates({ silent })` is called both on startup (silent) and from the App Header button (non-silent — shows a 2.2 s toast on no-update / error). `startInstall()` uses the `tauri-plugin-updater` `downloadAndInstall` callback to drive `downloadedBytes / totalBytes`, then `relaunch()`. The plugin's built-in dialog is disabled (`tauri.conf.json → plugins.updater.dialog: false`) — all UX runs through this store + `UpdateModal.vue`.

### Preview pipeline (`src/components/PreviewPane.vue`)

This is the most subtle file in the repo. Rendering flow per source change (debounced 150 ms):

1. `markdown-it` with `markdown-it-anchor` + `@vscode/markdown-it-katex` + a custom fence override that emits `<pre class="mermaid">` for ` ```mermaid ` blocks (Mermaid itself is **dynamically imported** only when such a block exists — keeps the cold-start lean).
2. The resulting HTML is post-processed to rewrite **relative `<img src>`** values: they're resolved against the active file's directory (`joinAndNormalize` handles both POSIX and `C:\` paths) and then passed through `convertFileSrc()` so the asset protocol (`assetProtocol.scope = ["**"]` in `tauri.conf.json`) can serve them. Absolute URLs (`http://`, `data:`, `/`, drive letters) pass through untouched.
3. `runMermaid()` re-renders any mermaid nodes, guarded by a `renderSeq` counter so a stale async run can't overwrite a newer render.
4. Scroll sync: `SourceEditor` emits a percent (0–1) on scroll; `PreviewPane` keeps a `ResizeObserver` on `.markdown-body` so it re-applies the percent when content height changes (covers Mermaid SVGs appearing late).

`buildStandaloneHtml(title)` is exposed via `defineExpose` and used by `EditorArea` for the "open in browser" flow — it inlines the highlight.js theme + a self-contained CSS block (separate from the in-app CSS) and links KaTeX CSS from the jsDelivr CDN.

### Editor (`src/components/SourceEditor.vue`)

CodeMirror 6 with `@codemirror/lang-markdown` + `@codemirror/theme-one-dark`. Toolbar actions mutate the document via CM transactions, not by re-emitting strings. Keyboard shortcuts `Cmd/Ctrl+S`, `Cmd/Ctrl+B`, `Cmd/Ctrl+I` are wired both in `App.vue` (global) and inside the editor's keymap.

## Conventions

- **Path handling**: always normalize backslashes to forward slashes before splitting (`PreviewPane.dirname` / `joinAndNormalize` show the pattern). The same file may be opened on Windows or macOS, so don't assume separator.
- **`scopeAll` is intentional** for `assetProtocol` — needed so the preview can load images from anywhere the user-selected workspace points to. Don't tighten it without rethinking the image-rewrite path.
- **No backend logging plugin** is configured; `console.error` in the frontend goes to the webview devtools, `eprintln!` / `tracing` in Rust goes to the terminal you ran `pnpm tauri:dev` from.
- **Workspace can be multi-root** as of v1.1 (`.code-workspace` files). The store still exposes `rootPath` (first root only) for places that operate on a "current" root, but new code should prefer `rootPaths`. Keep `parse_code_workspace`'s JSONC-stripping in mind — VSCode `.code-workspace` files routinely include comments.
- **Terminal Panel keeps its PTY alive across toggles** because `App.vue` mounts `BottomPanel` with `v-if="bottomPanelEverShown"` (one-shot latch) + `v-show="ui.bottomPanelVisible"` — don't refactor to `v-if` only or the shell will die every time the user closes the panel.
- **Layout structure**: `[AppHeader]` on top; below it `[ActivityBar][WorkArea]` where `WorkArea` is a column of `[Sidebar | Main]` over `[BottomPanel]`. The bottom panel spans the full width of the work area (sidebar + main), matching VSCode.

## macOS signing

The macOS build is **ad-hoc signed** (no Apple Developer ID). First-launch users hit Gatekeeper and must use System Settings → Privacy & Security → "Open Anyway", or `xattr -dr com.apple.quarantine /Applications/mdview.app`. The release workflow has placeholder env vars for notarization that can be filled in once a Developer ID is available.

---

## Icons

All icons use **Lucide** via `@iconify/vue`. The full icon set is registered offline at startup (`src/main.ts` calls `addCollection(lucideData)` — no CDN fetches). Use `<Icon icon="lucide:<name>" width="N" height="N" />` in any component. No additional setup needed for new icons; just pick a name from the Lucide catalog.

Common sizes in use: `12` (tree chevrons, tab close), `14` (toolbar, tree icons, inline buttons), `16` (header buttons, modal close), `22` (Activity Bar).

## v1.3.0 Roadmap

### Bug fixes

#### BUG-1: Updater "could not fetch a valid release JSON from remote"

**Root cause**: `.github/workflows/release.yml` sets `releaseDraft: true`. GitHub's `releases/latest` URL does **not** serve assets from draft releases — the updater endpoint `https://github.com/aniadev/mdview/releases/latest/download/latest.json` returns 404 until the draft is manually published. `tauri-action@v0` does generate `latest.json` automatically for Tauri v2, but it's unreachable while the release is a draft.

**Fix options** (pick one):
- **A (simpler)**: Change `releaseDraft: false` in `release.yml` so the release publishes automatically after all matrix jobs complete. Downside: no manual review window before publish.
- **B**: Keep draft, but add a final workflow job (needs: [build]) that runs `gh release edit $TAG --draft=false` to auto-publish once all builds succeed.

**Also check**: For the macOS universal build, `tauri-action` may generate two separate platform entries (`darwin-aarch64` / `darwin-x86_64`) pointing to the same universal binary. Add `updaterJsonKeepUniversal: true` to the macOS job's `with:` block so the JSON uses a single `darwin-universal` key instead — avoids signature mismatches when the updater plugin selects the wrong entry.

#### BUG-2: "New file" toolbar button creates at workspace root, not selected directory

**Root cause**: `ExplorerPanel.vue` `startRootCreate(root.path)` always passes `root.path` to `fsui.requestCreateIn()`. There is no concept of "currently selected directory" — the button always targets the root regardless of which folder the user is in.

**Fix**: Use the active tab's file path to derive the default directory. In `startRootCreate(rootPath)`, check `tabs.activeTab?.path` — if it falls within this root, compute its parent directory and pass that to `fsui.requestCreateIn()`; otherwise fall back to `rootPath`. This requires importing `useTabsStore` in `ExplorerPanel.vue` (already imported). No new store state needed.

```ts
function startRootCreate(rootPath: string) {
  const activeFilePath = tabs.activeTab?.path?.replace(/\\/g, '/');
  const normalizedRoot = rootPath.replace(/\\/g, '/');
  if (activeFilePath?.startsWith(normalizedRoot + '/')) {
    const lastSlash = activeFilePath.lastIndexOf('/');
    fsui.requestCreateIn(activeFilePath.slice(0, lastSlash));
  } else {
    fsui.requestCreateIn(rootPath);
  }
}
```

---

### New features

#### FEAT-1: Create folder

Allow users to create a new directory from the Explorer (context menu on a dir + `+` button in `ws-root-header`).

**Rust** (`lib.rs`):
- Add `create_dir(path: String) -> Result<String, String>` using `fs::create_dir_all`. Reject if `path` already exists.
- Register in `invoke_handler![]`. No new capability needed (covered by existing `fs:scope $HOME/**`).

**Frontend**:
- `fsui` store: add `pendingCreateDirInDir: ref<string | null>(null)` + `requestCreateDirIn(dir)` / cancel helper.
- `workspace` store: add `createDir(parentDir, name) -> Promise<string>` — invokes `create_dir`, then `refreshNodeChildren` or `refreshRoot`.
- `ExplorerPanel.vue`: add "New Folder" button to `ws-root-header` + context menu entry for dirs. Render `InlineFilenameInput` with `placeholder="folder-name"` for `pendingCreateDirInDir`.
- After creation, open the new folder in the tree (call `toggleDir` on it).

#### FEAT-2: Slash in filename auto-creates directories

Typing `game/game-1.md` in the new-file input should create the `game/` directory (and any parents) then create `game-1.md` inside it.

**Rust** (`lib.rs` — `create_md_file`):
- Remove the `contains(['/', '\\'])` rejection.
- Split `filename` on `/` and `\` to get path components. All but the last are directory segments; the last is the filename.
- Build `target_dir = dir_p.join(segments[..n-1])` and call `fs::create_dir_all(&target_dir)`.
- Append `.md` to the final segment if missing, then create the file.
- Return the absolute path of the created file.

**Frontend** (`workspace.ts` — `createMdFile`):
- After `invoke("create_md_file", ...)`, call `refreshParentOf(newPath)` as now — but since intermediate dirs may be new, also call `refreshRoot(rootPath)` if the intermediate dir wasn't visible in the tree. The existing `refreshParentOf` walks up and refreshes the nearest known ancestor, so it already handles this correctly as long as the tree node exists or the root is refreshed.

#### FEAT-3: Settings modal — full app metadata + native OS "Settings" menu item

**Settings modal** (`SettingsModal.vue`) — expand the "About" section:
- Author: `aniadev`
- License: MIT
- GitHub: `https://github.com/aniadev/mdview` (link — use `shell.open` via `@tauri-apps/plugin-opener`)
- Hardcode these values since they don't change at runtime (they're already in `tauri.conf.json` but no Tauri v2 API exposes them at runtime).

**Native OS menu entry** (Tauri v2 `tauri::menu` API in `lib.rs`):
- In the `setup()` closure, build a `MenuItem` with id `"settings"` and add it to the app menu. On macOS, add it to the first menu (app name menu) with accelerator `CmdOrCtrl+,` (standard macOS "Preferences" shortcut).
- Handle `MenuEvent` in the `run()` callback: emit a Tauri event `"open-settings"` to the webview.
- Frontend: in `App.vue` `onMounted`, listen for `open-settings` event and call `ui.openSettings()`.
- The in-app ⚙ toolbar button continues to work alongside this.

Implementation note: Tauri v2 menu API requires `tauri::menu::{Menu, MenuItem, Submenu}` and the `app.set_menu(menu)` call. On Windows/Linux a top-level menubar appears; on macOS it integrates with the system menu bar.

#### FEAT-4: Workspace management — create new, add folder, save as .code-workspace

**New workspace actions** (`workspace.ts`):

- `addFolderToCurrentWorkspace()` — opens a folder picker, appends the new root to `roots`, then calls `saveCurrentWorkspace()` if a `workspaceFile` exists, or prompts to save as new workspace file.
- `saveCurrentWorkspace()` — serializes `roots` as `{ "folders": [{ "path": <relative-if-possible>, "name": <name> }] }` and writes via `invoke("write_text", { path: workspaceFile, contents: JSON.stringify(..., null, 2) })`. Paths are made relative to the workspace file's directory when they share a common ancestor; otherwise absolute.
- `saveAsNewWorkspace()` — opens a save-file dialog (`.code-workspace` filter), writes the serialized JSON, then calls `openWorkspaceFile()` to reload (sets `workspaceFile` and persists the key).

**Rust**: No new command needed — `write_text` is already available.

**UI entry points** (`ExplorerPanel.vue` sidebar header):
- When `workspace.hasWorkspace && !workspace.workspaceFile`: show "Save as Workspace…" button.
- When `workspace.hasWorkspace`: show "Add Folder to Workspace" button (folder icon `+`).
- These can live in `.sidebar-actions` next to the existing close button, or in an overflow menu to avoid crowding.

**Dialog import**: `save` dialog from `@tauri-apps/plugin-dialog` (already a dependency).

#### FEAT-5: Activity Bar moves under sidebar header; sidebar becomes resizable

**Activity Bar relocation**:
- Remove `<ActivityBar />` from `App.vue`'s `.app-shell` flex row.
- Remove the `width: 48px` left column from layout.
- Move the two activity buttons (Explorer / Terminal) into `ExplorerPanel.vue` directly below `.sidebar-header`, as a horizontal `.sidebar-activity-row` bar. Keep the same `ui.toggleSidebar()` / `ui.toggleBottomPanel()` calls. The Explorer button is now redundant (it's inside the sidebar it toggles) — replace it with a "Collapse Sidebar" chevron, or keep it as an active indicator.
- Update `ActivityBar.vue` or inline the buttons directly in `ExplorerPanel.vue` and delete `ActivityBar.vue`.

**Sidebar resize**:
- `ui` store: add `sidebarWidth: ref(220)` (not persisted across sessions initially — add persistence later if needed).
- `Sidebar.vue`: set `width: ui.sidebarWidth + 'px'` as inline style. Min/max clamp: 140–480 px.
- Add a `<div class="sidebar-resize-handle">` at the right edge of `Sidebar.vue` (4 px wide, full height, `cursor: col-resize`).
- `mousedown` on handle: attach `mousemove` + `mouseup` listeners to `window`. `mousemove` updates `ui.sidebarWidth` by delta. `mouseup` removes listeners.
- `SplitPane.vue` already exists for the editor split — check if it can be reused, but the sidebar drag is simpler and doesn't need the same component.
- `App.vue`: the `.work-top` flex row already has `Sidebar` + `main` with `flex: 1` on main, so changing sidebar width via inline style works without layout changes.
- Don't use `v-show` tricks for the resize handle — use CSS `pointer-events: none` while sidebar is hidden.
