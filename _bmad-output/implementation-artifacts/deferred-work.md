# Deferred Work

## From: spec-multi-select-clipboard

- **ctxCut silent dir exclusion**: when multi-selection contains dirs + files, Cut silently skips dirs. No user warning. Could disable Cut button or show toast "N dir(s) skipped" when dirs are in selection.
- **selectedItems Map rebuild on every Cmd+Click**: `toggleSelection` creates new Map each call, triggering full tree reactivity. Consider mutable approach with manual `triggerRef()` if perf becomes issue on large trees.

## From: v1.7.0 breakdown (deferred after split)

- **shadcn/vue design system migration** (S-SD1→S-SD5): setup + Button, DropdownMenu, Dialog, Input, Tooltip migration. Breakdown at `_bmad-output/planning-artifacts/breakdown-v1.7.0.md`.
- **Open Terminal Here** (S-OT1, S-OT2): pty_spawn cwd param + context menu item. Breakdown at same file.
- **Obsidian features** (S-OB1, S-OB2): Wikilink autocomplete + Quick Switcher enhanced. Breakdown at same file.
- **Graph View research**: prototype only, not shipping. Breakdown at same file.

## From: spec-v1.7.0-bugfixes review (loopback #2)

- **`ensureDirExpanded` race condition**: no loading guard — rapid concurrent calls to same path could double-trigger `listDir`. Current codebase design makes this unlikely (single-threaded UI event handlers) but worth adding `node.loading` guard if reports surface.
- **`ensureDirExpanded` uses shared `error.value`**: swallows errors into global store error — matches existing `toggleDir` pattern. Consider per-node error state if error-specific recovery UX is needed later.

## From: v1.8.0 Knowledge Graph spec (token-split — primary = Graph View only)

- **Backlinks Panel** (S-BL1→S-BL3): Rust `find_backlinks` command (consume cached `LinkGraph` from S-GV1), `BacklinksPanel.vue` listing inbound links with context snippet, integrate into `PreviewPane.vue` as bottom section. Picks up cache built by Graph View spec; ship as v1.8.0 follow-up PR.

## From: v1.8.0 Graph View review (step-04)

- **URL-decode percent-encoded MD link targets** (`lib.rs` MD_RE): `[t](./my%20note.md)` currently fails resolve because the `%20` is treated literally. Add `percent_decode` before joining/checking. Low priority — pathological in typical mdview workflow.
- **Inline code span (backtick) exclusion in link parser** (`parse_links_in_text`): currently only excludes fenced code blocks; inline `` `[[fake]]` `` matches as a link. Spec I/O Matrix only mandates fenced exclusion, but Obsidian-parity would require stripping inline code spans per line before regex match.

## From: v1.8.0 breakdown (deferred after split — primary goal = Knowledge Graph S-GV + S-BL)

Breakdown: `_bmad-output/planning-artifacts/breakdown-v1.8.0.md`

- **Frontmatter / Properties Editor** (S-FM1→S-FM4): YAML frontmatter parser utils, `properties.ts` store, `PropertiesPanel.vue` form editor, Daily Notes auto-fill integration.
- **Page Templates** (S-TP1→S-TP3): extend Rust `create_md_file` with `template_path` + placeholder substitution, `TemplateChooser.vue`, New File flow + Settings folder config.
- **Callouts / Admonitions** (S-CL1, S-CL2): `> [!type]` blockquote post-process in `PreviewPane.vue`, `SourceEditor.vue` toolbar dropdown to insert callout templates.
- **Tags Pane** (S-TG1→S-TG3): Rust `extract_tags` (frontmatter + inline `#tag`), `TagsPanel.vue` sidebar list, file-tree filter by tag.
- **Export PDF** (S-EX1): `window.print()` from `PreviewPane.vue` + expanded `print.scss` (A4, hide chrome, page-break on h1).
- **Page History research** (no story): prototype snapshot-based versioning, defer GA to v1.9.0.
