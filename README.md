# mdview

Focused desktop editor for Markdown files inside a project folder. Tauri + Vue 3 + TypeScript.

Add a folder, see your `.md` files in a sidebar that dims directories without any Markdown, edit them in a split-pane source + GFM preview, jump between files with `Cmd/Ctrl+P`, and export rendered HTML to your default browser.

![mdview-screenshot](./public/screenshot.png)

## Features

- **Workspace** — single folder, persisted across sessions
- **File Tree** — folders without `.md` (anywhere underneath) are dimmed
- **Tabs** — multiple open files, dirty indicator, close-confirm on unsaved changes
- **Split-pane editor** — CodeMirror 6 source + GFM preview, draggable divider, scroll-synced
- **Toolbar** — Bold / Italic / Heading / Underline / Strikethrough / lists / checklist / quote / code block / table / link / image / open-in-browser
- **Math** — KaTeX (`$inline$`, `$$block$$`)
- **Mermaid** — fenced ```` ```mermaid ```` diagrams, lazy-loaded
- **Themes** — dark (default) and light, persisted
- **Command Palette** — `Cmd/Ctrl+P`, fuzzy match on basename
- **Open in browser** — snapshot current preview to a temp HTML and open via system browser
- **Shortcuts** — `Cmd/Ctrl+S` save, `Cmd/Ctrl+W` close tab, `Cmd/Ctrl+B` bold, `Cmd/Ctrl+I` italic, `Cmd/Ctrl+P` palette

## macOS install note

mdview is **not yet** signed with an Apple Developer ID (no paid Developer Program subscription). The bundle is ad-hoc signed, which means macOS Gatekeeper will block first launch with a "cannot be opened" / "harmful" warning.

Pick one of these to unblock after installing:

**Option A — System Settings (no terminal):**

1. Try to open mdview from `/Applications` (you'll see the warning).
2. Open **System Settings → Privacy & Security**.
3. Scroll to the bottom — you'll see *"mdview was blocked..."* → click **Open Anyway**.
4. Confirm in the next dialog.

**Option B — Terminal one-liner:**

```sh
xattr -dr com.apple.quarantine /Applications/mdview.app
```

You only need to do this once per install. Future updates installed via the in-app updater inherit the trust.

If you'd prefer a fully notarized build, the project is set up to opt in once an Apple Developer ID is available; see `.github/workflows/release.yml` for the placeholder env block.

## Requirements

- Node 18+ and pnpm
- Rust toolchain (`rustup`)
- Platform deps for Tauri 2 (see https://tauri.app/start/prerequisites/)

## Develop

```sh
pnpm install
pnpm tauri:dev
```

## Build installer

```sh
pnpm tauri:build              # current platform, default bundle targets
pnpm tauri:build:mac          # macOS .app + .dmg (current arch)
pnpm tauri:build:mac-universal # macOS universal (x86_64 + arm64)
pnpm tauri:build:win          # Windows x64 NSIS + MSI (requires Windows host or cross-compile setup)
pnpm tauri:build:win-arm      # Windows arm64 NSIS + MSI
```

Artifacts land in `src-tauri/target/<triple>/release/bundle/`.

### Cross-compile for Windows from macOS / Linux

Native Windows installers (NSIS / MSI) generally need a Windows host or [`cargo-xwin`](https://github.com/rust-cross/cargo-xwin). The provided `tauri:build:win` script assumes a Windows toolchain is installed. The recommended workflow is to run it on Windows or in GitHub Actions with a `windows-latest` runner.

### GitHub Actions

- `.github/workflows/ci.yml` — typecheck + frontend build + Rust check + clippy on every push / PR to `main`.
- `.github/workflows/release.yml` — triggered by a `v*` tag push or manual `workflow_dispatch` (provide the tag). Matrix builds **macOS universal**, **Windows x64**, and **Windows arm64** via `tauri-apps/tauri-action`, uploads installers to a **draft** GitHub Release.

To cut a release:

```sh
git tag v1.0.0
git push origin v1.0.0
```

Then publish the draft release on GitHub once artifacts are uploaded.

### Regenerate icons

Source icon: `public/mdview.png`.

```sh
pnpm icons
```

Regenerates all platform icons into `src-tauri/icons/`.

## Layout

- `src/` — Vue 3 frontend (Pinia stores, components, styles)
- `src-tauri/` — Rust backend (Tauri commands, plugin wiring, capabilities)
- `_bmad-output/planning-artifacts/prds/` — product requirements

## License

MIT
