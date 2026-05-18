# mdview

Focused desktop editor for Markdown files inside a project folder. Tauri + Vue 3 + TypeScript.

Add a folder, see your `.md` files in a sidebar that dims directories without any Markdown, edit them in a split-pane source + GFM preview, jump between files with `Cmd/Ctrl+P`, and export rendered HTML to your default browser.

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
pnpm tauri:build
```

Artifacts land in `src-tauri/target/release/bundle/`.

## Layout

- `src/` — Vue 3 frontend (Pinia stores, components, styles)
- `src-tauri/` — Rust backend (Tauri commands, plugin wiring, capabilities)
- `_bmad-output/planning-artifacts/prds/` — product requirements

## License

MIT
