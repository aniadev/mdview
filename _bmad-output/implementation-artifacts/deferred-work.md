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

## From: v1.8.0 Backlinks review (step-04)

- **`LinkGraphCache` Mutex poison propagation**: `find_backlinks` + `build_link_graph` both `?`-propagate `PoisonError`. Once any holder panics, the cache is permanently broken until app restart. Consider `.unwrap_or_else(|p| p.into_inner())` recovery. Pre-existing pattern across both commands.
- **`LinkGraphCache` TOCTOU double-build**: two concurrent `find_backlinks` / `build_link_graph` calls with cache miss both run `build_graph_impl` (expensive parallel scan) and overwrite cache. Wasted CPU, no corruption. Hold the lock through rebuild or switch to a "check-then-insert with rebuild flag" pattern.
- **Unbounded source-file read in `build_backlink_entries`**: each backlink source is fully read into memory. A multi-MB markdown source DoSes the panel. Pre-existing pattern (same applies to `build_graph_impl`); cap read size or stream if reports surface.
- **No FS-scope check on `roots: Vec<String>`**: `build_link_graph` / `find_backlinks` accept arbitrary roots from frontend without confirming they sit under the Tauri FS scope. Same pattern in `read_text` and other unscoped commands. Could harden across the board.
- **Windows path separator round-trip in `tabs.openFile`**: `BacklinksPanel` passes `from_file` (forward-slash from Rust) to `tabs.openFile`; on Windows other code paths feed native backslash paths. Click-to-open from backlink may produce a duplicate tab when the same file was originally opened from the explorer. Normalize at the `tabs` store boundary.
