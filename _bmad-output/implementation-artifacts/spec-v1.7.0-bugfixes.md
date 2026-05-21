---
title: 'v1.7.0 Bug Fixes — Preview Rendering & New File UX'
type: 'bugfix'
created: '2026-05-21'
status: 'done'
baseline_commit: 'e7a7646f2b5264bb3808a1d5e39f1a0a0643d265'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Three rendering/UX bugs in v1.6.x: (1) single newlines in markdown don't render as `<br>` because `breaks: false` in MarkdownIt config, (2) task-list checkboxes and ordered/unordered list styling are broken — no CSS for checkbox alignment, Tailwind preflight resets `list-style`, (3) creating a new file/folder inside a collapsed directory shows nothing because the `InlineFilenameInput` requires `node.expanded === true`.

**Approach:** Fix each at its source: `breaks: true` in MarkdownIt, explicit CSS for task lists + list-style-type, and `workspace.ensureDirExpanded(path)` called before `requestCreateIn/requestCreateDirIn` in ExplorerPanel flow.

## Boundaries & Constraints

**Always:**
- `breaks: true` only — do not add `markdown-it-br` plugin
- CSS changes stay scoped inside `.markdown-body` in `PreviewPane.vue` `<style>` block
- `ensureDirExpanded(path)` must be idempotent: do not collapse if already expanded
- Call `ensureDirExpanded` before `requestCreateIn/requestCreateDirIn`, not after

**Ask First:**
- N/A — all changes are low-risk, single-file, no architectural decisions

**Never:**
- Do not touch Tailwind preflight config — fix only in `.markdown-body` CSS scope
- Do not change `FileTreeNode.vue` `showCreateChild`/`showCreateDirChild` computed logic — fix at the call site in ExplorerPanel
- Do not modify `onCreateCommit`/`onCreateDirCommit` in `FileTreeNode.vue` — they already have `toggleDir` guard, but it runs too late (after commit, not before showing input)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Soft line break | `"line one\nline two"` with `breaks: true` | Renders as `line one<br>line two` | N/A |
| Task list item | `- [ ] task` in markdown source | Checkbox aligned with text via flex, `cursor: pointer` | N/A |
| Nested unordered list | `\n  - item\n` | `ul` renders with `disc` bullets, nested `ul` inherits `circle` | N/A |
| Ordered list | `1. first\n2. second` | `ol` renders with decimal numbering | N/A |
| New File on collapsed dir | `fsui.requestCreateIn("/a/b")`, `/a/b` dir collapsed | Dir auto-expands, input renders immediately | N/A |
| New File on already-expanded dir | Same, dir expanded | `ensureDirExpanded` no-ops, input renders (no regression) | N/A |
| New Folder on collapsed dir | `fsui.requestCreateDirIn("/a")`, `/a` collapsed | Dir auto-expands, input renders immediately | N/A |
| New File from root header | `startRootCreate(rootPath)` with active tab path under root | Creates in active tab's parent dir, that dir auto-expanded if needed | N/A |
| `ensureDirExpanded` on non-existent path | Path not found in tree | No-op, no error — falls through to existing behavior | Silently skip |

</frozen-after-approval>

## Code Map

- `src/components/PreviewPane.vue:44` — MarkdownIt constructor with `breaks: false` (S-BF1)
- `src/components/PreviewPane.vue:556-564` — current `ul/ol/li` CSS in `.markdown-body` (S-BF2)
- `src/components/PreviewPane.vue:175-199` — `render()` method with checkbox post-processing (S-BF2)
- `src/styles/tailwind.css:1` — `@import "tailwindcss"` includes preflight reset (S-BF2 context)
- `src/components/PreviewPane.vue:412-604` — full `<style>` block for CSS additions (S-BF2)
- `src/components/ExplorerPanel.vue:113-125` — `ctxNewFile()` and `ctxNewFolder()` (S-BF3)
- `src/components/ExplorerPanel.vue:190-203` — `startRootCreate()` and `startRootCreateDir()` (S-BF3)
- `src/stores/workspace.ts:219-236` — `toggleDir` logic for expand/collapse (S-BF3)
- `src/stores/fsui.ts:89-99` — `requestCreateIn`/`requestCreateDirIn` setters (S-BF3)

## Tasks & Acceptance

**Execution:**
- [x] `src/components/PreviewPane.vue` — change `breaks: false` to `breaks: true` in MarkdownIt constructor at line ~44 — enables soft-break `<br>` rendering
- [x] `src/components/PreviewPane.vue` — add CSS in `<style>` block: `ul { list-style-type: disc }`, `ol { list-style-type: decimal }`, `ul ul { list-style-type: circle }`, `ul ul ul { list-style-type: square }` for nested lists — override Tailwind preflight reset
- [x] `src/components/PreviewPane.vue` — add CSS in `<style>` block: `li:has(> input[type="checkbox"])` with `display: flex; align-items: flex-start; gap: 6px; list-style: none; cursor: pointer` and add `input[type="checkbox"]` rule with `margin-top: 3px; flex-shrink: 0; cursor: pointer` — checkbox alignment in task lists (flex suppresses `::marker` so `list-style: none` makes intent explicit)
- [x] `src/stores/workspace.ts` — add `ensureDirExpanded(path: string)` method: find node by path, if found and `is_dir` and `!expanded`, lazy-load children if needed, set `expanded = true`. If `listDir` throws, set `error` and **return early** (do NOT set `expanded = true`) — idempotent expand, no-op on load failure
- [x] `src/components/ExplorerPanel.vue` — in `ctxNewFile()`: compute targetDir, `await workspace.ensureDirExpanded(targetDir)`, then `fsui.requestCreateIn(targetDir)` — auto-expand dir before showing input placeholder
- [x] `src/components/ExplorerPanel.vue` — in `ctxNewFolder()`: compute targetDir, `await workspace.ensureDirExpanded(targetDir)`, then `fsui.requestCreateDirIn(targetDir)` — same for new folder
- [x] `src/components/ExplorerPanel.vue` — in `startRootCreate()`: make function `async`, compute the target dir, `await workspace.ensureDirExpanded(targetDir)`, then `fsui.requestCreateIn(targetDir)` — new file from root header button
- [x] `src/components/ExplorerPanel.vue` — in `startRootCreateDir()`: make function `async`, `await workspace.ensureDirExpanded(rootPath)`, then `fsui.requestCreateDirIn(rootPath)` — new folder from root header button

**Acceptance Criteria:**
- Given a markdown file with `"line A\nline B"` (no blank line between), when preview is rendered, then line B appears on a new line (`<br>` break)
- Given a markdown file with `- [ ] Task item`, when preview is rendered, then checkbox is aligned with text via flex, has `cursor: pointer`, and is clickable
- Given a markdown file with `- Level 1\n  - Level 2`, when preview is rendered, then Level 1 has `disc` bullet, Level 2 has `circle` bullet
- Given a markdown file with `1. First\n2. Second`, when preview is rendered, then numbers 1 and 2 appear before each item
- Given a workspace with collapsed directory `/a/b`, when user right-clicks `/a/b` → "New File", then `/a/b` expands and the filename input placeholder appears as the first child
- Given a workspace with already-expanded directory `/a/b`, when user right-clicks `/a/b` → "New File", then input appears immediately (no double-toggle, no regression)
- Given a workspace root with collapsed child directories, when user clicks the root's "new file" button and the active tab is under that root, then the active tab's parent directory expands and the input appears

## Spec Change Log

### Loopback 1 (2026-05-21) — Review Findings

**Triggering findings:**
- (bad_spec) `ensureDirExpanded` called without `await` in `startRootCreate` / `startRootCreateDir` — function is async, expansion races ahead of `requestCreateIn` when children not cached
- (bad_spec) `ensureDirExpanded` sets `expanded = true` even after `listDir` throws — `catch` block doesn't return, node appears expanded with `undefined` children
- (bad_spec) `li:has(> input[type="checkbox"])` missing `cursor: pointer` and should have explicit `list-style: none`

**What was amended:**
- Tasks 72-73: changed "call `workspace.ensureDirExpanded`" → "`await workspace.ensureDirExpanded`", added "make function `async`"
- Task 69: added early return after catch clause to prevent setting expanded on load failure
- Tasks 67-68: merged into one task, added `list-style: none` and `cursor: pointer` to the li rule

**Known-bad state avoided:**
- Silently failing expansion (fire-and-forget Promise) causing InlineFilenameInput to not render
- Corrupted tree node state: expanded=true with undefined children after failed load
- Missing cursor: pointer on task list item wrapper

**KEEP:**
- `breaks: true` change from S-BF1 — correct, 1 line
- All CSS list-style-type rules (ul, ol, ul ul, ol ol, etc.) — correct
- `ctxNewFile`/`ctxNewFolder` already had `await` — correct, keep as-is
- `ensureDirExpanded` core structure (normalize → findNodeByPath → expand) — correct

## Verification

**Commands:**
- `pnpm typecheck` — expected: no new type errors
- `pnpm build` — expected: successful build, no new CSS breakage
- `cargo check --manifest-path src-tauri/Cargo.toml` — expected: unchanged (no Rust changes this spec)

**Manual checks (if no CLI):**
- Open a test `.md` with single newlines, checkboxes `- [ ]`, nested lists `  - item`, ordered lists — verify all render correctly in preview pane
- Collapse a directory in the file tree, right-click → "New File" — verify directory expands and input placeholder appears
- Collapse a directory, click root header "new file" button with a file in that dir active — verify dir expands and input appears

## Suggested Review Order

**Entry Point — `ensureDirExpanded` (S-BF3)**

- New idempotent expand method: early return on error, no toggle on expanded
  [`workspace.ts:238`](../../src/stores/workspace.ts#L238)

**Auto-expand call sites (S-BF3)**

- Context menu file creation now awaits expand before showing input
  [`ExplorerPanel.vue:113`](../../src/components/ExplorerPanel.vue#L113)

- Context menu folder creation same pattern
  [`ExplorerPanel.vue:121`](../../src/components/ExplorerPanel.vue#L121)

- Root header buttons made async with await expand
  [`ExplorerPanel.vue:191`](../../src/components/ExplorerPanel.vue#L191)

**Markdown rendering fixes (S-BF1 + S-BF2)**

- Single-line change: breaks flag forces soft-break `<br>` rendering
  [`PreviewPane.vue:45`](../../src/components/PreviewPane.vue#L45)

- List bullets restored: explicit list-style-type overrides Tailwind preflight
  [`PreviewPane.vue:562`](../../src/components/PreviewPane.vue#L562)

- Task list checkbox alignment via flex with cursor and list-style: none
  [`PreviewPane.vue:581`](../../src/components/PreviewPane.vue#L581)
