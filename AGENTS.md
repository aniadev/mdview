# AGENTS.md

## Commands

```sh
pnpm install
pnpm tauri:dev                     # full app (Vite + Rust) — the only way to exercise Tauri commands
pnpm dev                           # frontend only (invoke() will fail)
pnpm typecheck                     # vue-tsc --noEmit
pnpm build                         # typecheck + vite build → dist/
pnpm icons                         # regenerate icons from public/mdview.png
```

Quality gates (CI runs both): `pnpm typecheck` + `cargo check --manifest-path src-tauri/Cargo.toml` + `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`. No test runner.

Release: tag `v*` and push — the matrix build produces macOS universal + Windows x64/arm64 + Linux x86_64 via `tauri-apps/tauri-action`.

## Architecture

Two-process: Vue 3 frontend (`src/`) ↔ Tauri 2 Rust backend (`src-tauri/src/lib.rs`) via `invoke()`. Vite dev server on port **1420** (hard-coded, must be free).

All FS access goes through Rust commands — the frontend never uses `@tauri-apps/plugin-fs` directly. Commands: `list_dir`, `list_md_files`, `read_text`, `write_text`, `path_exists`, `write_temp_html`, `create_md_file`, `rename_path`, `delete_file`, `create_dir`, `parse_code_workspace`, `pty_spawn/write/resize/kill`, `consume_pending_open_files`.

When adding a Rust command: register in `invoke_handler![]` at the bottom of `lib.rs` **and** update `src-tauri/capabilities/default.json`. FS scope covers `$HOME/**`, `/tmp/**`, `/Volumes/**`.

## Conventions

### Paths

Normalize backslashes → forward slashes before splitting. Same file may open on Windows or macOS — never assume separator.

### Workspace is multi-root

`workspace` store supports both `workspace_path` (legacy single folder) and `workspace_file` (`.code-workspace` path). The file wins on restore. `rootPaths` (array) for palette/dedup; `rootPath` (first root) for backwards compat. VSCode `.code-workspace` files include comments — `parse_code_workspace` strips JSONC before parsing.

### Terminal Panel PTY lifecycle

`App.vue` mounts `BottomPanel` with `v-if="bottomPanelEverShown"` (one-shot latch) + `v-show="ui.bottomPanelVisible"`. Do **not** refactor to plain `v-if` — the shell dies on every panel close. Terminal tabs use `v-show` so closed-but-inactive sessions keep their PTY + xterm buffer alive.

### Preview pipeline (`PreviewPane.vue`)

- Mermaid is **dynamically imported** only when a ` ```mermaid ` block exists — keeps cold start lean.
- `renderSeq` counter guards against stale async Mermaid renders overwriting newer ones.
- Relative `<img src>` values are resolved against the active file's directory then passed through `convertFileSrc()` for the Tauri asset protocol (`scopeAll` is intentional — needed for arbitrary workspace images).
- Scroll sync: editor emits percent (0–1), `ResizeObserver` re-applies when content height changes (handles late-arriving Mermaid SVGs).

### Editor (`SourceEditor.vue`)

CodeMirror 6 toolbar actions mutate the document via CM **transactions**, not by re-emitting strings.

### Icons

Lucide via `@iconify/vue`, registered offline (`addCollection(lucideData)` in `main.ts`). Use `<Icon icon="lucide:<name>" width="N" height="N" />`. Sizes in use: `12` (tree/tab), `14` (toolbar), `16` (header), `22` (Activity Bar).

### Layout

`[AppHeader] / [Sidebar | Main] over [BottomPanel]`. Bottom panel spans full width of work area (sidebar + main). Activity buttons moved into `ExplorerPanel.vue` `.sidebar-activity-row`.

### Logging

Frontend: `console.error` → webview devtools. Rust: `eprintln!`/`tracing` → terminal running `pnpm tauri:dev`. No plugin-based logging.

## macOS

Ad-hoc signed (no Developer ID). First-launch users hit Gatekeeper: System Settings → Privacy & Security → "Open Anyway", or `xattr -dr com.apple.quarantine /Applications/mdview.app`.
