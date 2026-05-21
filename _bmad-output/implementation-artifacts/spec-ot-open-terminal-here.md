---
title: 'Open Terminal Here — Explorer Context Menu'
type: 'feature'
created: '2026-05-21'
status: 'done'
baseline_commit: '1afb83e64a1acdb4364ddd74d3f5e633efc3a39a'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Terminal always opens at workspace root (`rootPath`). No way to quickly open a shell at a specific subdirectory — user must `cd` manually after every open.

**Approach:** Add "Open Terminal Here" to the Explorer right-click menu for files and folders. Compute `targetDir` from the clicked node, make the bottom panel visible, and spawn a new PTY session with `cwd = targetDir`. `pty_spawn` already accepts `cwd: Option<String>` in Rust — only frontend changes needed.

## Boundaries & Constraints

**Always:**
- `targetDir` for a file node = `parentOf(path)`; for a folder node = `path` itself
- Rust command `pty_spawn` must NOT be modified — it already handles optional `cwd` correctly
- Bottom panel must be shown (not toggled) — use `ui.showBottomPanel()`, never `toggleBottomPanel()`, so an already-visible panel isn't accidentally hidden
- New PTY session is always created (don't reuse an existing session whose shell may be in an arbitrary state)
- Show "Open Terminal Here" for both files and folders (no `v-if` restriction on node type)

**Ask First:**
- N/A — straightforward frontend-only change, no architectural decisions

**Never:**
- Do not modify `src-tauri/src/lib.rs` — Rust side is already correct
- Do not change the default `spawn()` flow in `TerminalView.vue` for sessions without `cwd` — `session.cwd ?? workspace.rootPath ?? undefined` preserves existing behavior
- Do not add `cwd` to the terminal store's `ensureFirst()` auto-created session — that session stays at workspace root

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Right-click file, panel hidden | `targetPath = "/a/b/note.md"`, `isDir = false`, panel invisible | `targetDir = "/a/b"`, panel shown, new session spawns at `/a/b` | N/A |
| Right-click folder, panel hidden | `targetPath = "/a/b"`, `isDir = true`, panel invisible | `targetDir = "/a/b"`, panel shown, new session spawns at `/a/b` | N/A |
| Right-click when panel already visible | panel visible with existing session | Panel stays open, new session added and made active | N/A |
| `cwd` doesn't exist on disk | `targetDir` path deleted before spawn | Rust validates `p.is_dir()` — falls back to `home_dir()` silently | No user error needed — Rust fallback handles it |

</frozen-after-approval>

## Code Map

- `src/stores/terminal.ts:4-9` — `TerminalSession` interface; `createSession():27` — no `cwd` field yet
- `src/components/TerminalView.vue:74-85` — `spawn()` reads `workspace.rootPath` as cwd; needs to prefer `props.session.cwd`
- `src/stores/ui.ts:11,43-44` — `bottomPanelVisible` ref; `toggleBottomPanel()` — need new `showBottomPanel()`
- `src/components/ExplorerPanel.vue:113-135` — existing `ctxNewFile/ctxNewFolder/ctxDelete` pattern to follow; `parentOf` helper already present
- `src/components/ExplorerPanel.vue:474-490` — context menu template; `fsui.ctxMenu.isDir` / `fsui.ctxMenu.targetPath` available
- `src/i18n/index.ts:30-38` — `ctx.*` key block

## Tasks & Acceptance

**Execution:**
- [x] `src/stores/terminal.ts` — add `cwd?: string` to `TerminalSession` interface; add `cwd?: string` param to `createSession()`, store it in the session object — lets TerminalView read the intended working directory per session
- [x] `src/components/TerminalView.vue` — in `spawn()` at line 76, replace `workspace.rootPath ?? undefined` with `props.session.cwd ?? workspace.rootPath ?? undefined` — sessions with explicit cwd use it; others fall back to workspace root as before
- [x] `src/stores/ui.ts` — add `showBottomPanel()` function: `bottomPanelVisible.value = true`; export it — avoids accidental hide when panel already visible
- [x] `src/i18n/index.ts` — add `'ctx.openTerminalHere': { en: 'Open Terminal Here', vi: 'Mở Terminal tại đây' }` in the `ctx.*` block
- [x] `src/components/ExplorerPanel.vue` — import `useTerminalStore`; add `ctxOpenTerminalHere()`: compute `targetDir` (`isDir ? targetPath : parentOf(targetPath)`), call `ui.showBottomPanel()`, call `terminal.createSession(targetDir)` — note `createSession` label arg comes first, cwd second: update signature accordingly
- [x] `src/components/ExplorerPanel.vue` — add `<button class="ctx-item" @click="ctxOpenTerminalHere">{{ t('ctx.openTerminalHere') }}</button>` to context menu template (no `v-if` restriction — visible for both files and dirs)

**Acceptance Criteria:**
- Given any file or folder in the Explorer, when user right-clicks it, then "Mở Terminal tại đây" appears in the context menu
- Given user clicks "Open Terminal Here" on a folder, when bottom panel opens, then the new terminal session's shell starts in that folder (verified by `pwd` output)
- Given user clicks "Open Terminal Here" on a file, when bottom panel opens, then the new terminal session's shell starts in the file's parent directory
- Given the bottom panel is already visible with an active session, when user triggers "Open Terminal Here", then panel stays visible and a new session tab is added and activated (existing session unaffected)

## Verification

**Commands:**
- `pnpm typecheck` — expected: no new type errors
- `cargo check --manifest-path src-tauri/Cargo.toml` — expected: unchanged (no Rust changes)

## Suggested Review Order

**Entry point — context menu action**

- Main handler: computes targetDir, shows panel, spawns session
  [`ExplorerPanel.vue:134`](../../src/components/ExplorerPanel.vue#L134)

- Template binding: button visible for both files and folders (no v-if)
  [`ExplorerPanel.vue:493`](../../src/components/ExplorerPanel.vue#L493)

**Session cwd storage**

- Interface field: cwd stored on session, survives until TerminalView mounts
  [`terminal.ts:9`](../../src/stores/terminal.ts#L9)

- createSession now accepts optional cwd, written synchronously before push
  [`terminal.ts:28`](../../src/stores/terminal.ts#L28)

**cwd propagation to PTY**

- spawn() prefers session.cwd over workspace.rootPath fallback
  [`TerminalView.vue:76`](../../src/components/TerminalView.vue#L76)

**Panel show guard**

- showBottomPanel sets visible=true without toggling (can't accidentally hide)
  [`ui.ts:47`](../../src/stores/ui.ts#L47)

**Peripherals**

- i18n key with Vietnamese translation
  [`index.ts:39`](../../src/i18n/index.ts#L39)
