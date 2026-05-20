# Deferred Work

## From: spec-multi-select-clipboard

- **ctxCut silent dir exclusion**: when multi-selection contains dirs + files, Cut silently skips dirs. No user warning. Could disable Cut button or show toast "N dir(s) skipped" when dirs are in selection.
- **selectedItems Map rebuild on every Cmd+Click**: `toggleSelection` creates new Map each call, triggering full tree reactivity. Consider mutable approach with manual `triggerRef()` if perf becomes issue on large trees.
