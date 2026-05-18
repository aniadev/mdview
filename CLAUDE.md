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
- `list_md_files(root)` — flat recursive list of all `.md` files, used by the command palette.
- `read_text` / `write_text` — UTF-8 file IO.
- `path_exists` — used to validate a restored workspace path on startup.
- `write_temp_html(html, base_name)` — writes a self-contained HTML snapshot to the OS temp dir; the frontend then calls `openPath` (opener plugin) to launch it in the system browser. Filename is sanitized (alphanumeric + `-_` only) and timestamped.

When adding a Rust command: register it in the `invoke_handler![]` macro at the bottom of `lib.rs` **and** add any new permission to `src-tauri/capabilities/default.json`. The current capability grants `fs:scope` for `$HOME/**` only — paths outside that will fail at runtime.

### Frontend state (Pinia stores in `src/stores/`)

- `workspace` — the single root folder. Persisted via `@tauri-apps/plugin-store` to `mdview-settings.json` under key `workspace_path`. `restoreWorkspace()` runs on mount and validates the path still exists. The tree is lazy: only the root level is loaded; `toggleDir()` populates children on first expand.
- `tabs` — open files. Dirty = `content !== savedContent`. `closeTab` confirms via Tauri's native dialog when dirty. `openFile` is idempotent (existing tab is just re-activated).
- `palette` — `Cmd/Ctrl+P` fuzzy file picker. Refreshes from `list_md_files` on workspace change.
- `theme` — `dark` (default) / `light`, persisted in the same store file. Toggling re-initializes Mermaid and swaps the highlight.js stylesheet.

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
- **Workspace is a singleton** by design (PRD constraint) — don't add multi-root support without checking `_bmad-output/planning-artifacts/` first.

## macOS signing

The macOS build is **ad-hoc signed** (no Apple Developer ID). First-launch users hit Gatekeeper and must use System Settings → Privacy & Security → "Open Anyway", or `xattr -dr com.apple.quarantine /Applications/mdview.app`. The release workflow has placeholder env vars for notarization that can be filled in once a Developer ID is available.
