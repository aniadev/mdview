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
