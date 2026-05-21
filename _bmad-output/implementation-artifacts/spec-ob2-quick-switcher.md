---
title: 'Quick Switcher — Recent Files & Heading Search'
type: 'feature'
created: '2026-05-21'
status: 'done'
baseline_commit: '9c652f138bf34814bed387400a108d73f65539ef'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Command Palette always opens with an alphabetical file list and no recency awareness. Finding recently-visited files requires re-typing their names. There is no way to jump to a specific heading inside any file.

**Approach:** When the palette opens with no query and recent files exist, show the 5 most-recently-opened files instead of the default alpha list. When the query starts with `#`, switch to heading-search mode: scan all open tabs' markdown content with a regex, filter by the text after `#`, and list matching headings with their source file name.

## Boundaries & Constraints

**Always:**
- Recent file order comes from a new `recentPaths: string[]` ref in `tabs` store — updated on every `openFile()` call (move path to front, cap at 20). In-memory only; not persisted.
- When query is empty and `recentPaths` has entries: show top 5 as the list — do NOT show the full alpha list alongside them. When `recentPaths` is empty, fall back to existing top-20 behavior unchanged.
- Heading search (`#`): scan `tab.content` for all currently open tabs using `/^(#{1,6})\s+(.+)/gm`. Selecting a heading result calls `tabs.openFile` — no scroll-to-heading in this story.
- `moveSelection` in `palette.ts` must accept an optional `total` param so the component can pass the correct list length regardless of mode.
- `palette.files` must be exposed from `usePaletteStore` so `CommandPalette.vue` can map recent paths to `MdFile` objects.

**Ask First:**
- N/A

**Never:**
- Do not persist `recentPaths` to disk — in-memory session only
- Do not attempt scroll-to-heading on select — just open the file
- Do not modify Fuse.js search logic or the existing `results` computed
- Do not show recents AND the full list simultaneously — recents replace the empty-query list

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Palette opens, recents exist | `recentPaths = ["/a/b.md", "/a/c.md"]`, query empty | Shows top 5 recent files with "Gần đây" label; no full alpha list | N/A |
| Palette opens, no recents | `recentPaths = []`, query empty | Falls back to existing top-20 alpha list (no label) | N/A |
| Normal fuzzy query | `query = "notes"` | Existing Fuse.js results, no recents section | N/A |
| Heading mode, open tabs exist | `query = "#intro"` | Lists all headings matching "intro" across open tabs, shows file name as subtitle | N/A |
| Heading mode, no matches | `query = "#zzz"`, no heading contains "zzz" | Shows "Không tìm thấy tiêu đề" empty state | N/A |
| Heading mode, `#` only (no text) | `query = "#"` | Shows ALL headings from all open tabs | N/A |
| Path in `recentPaths` not in `palette.files` | File deleted from disk since session start | Entry silently skipped (`.filter(Boolean)`) | N/A |

</frozen-after-approval>

## Code Map

- `src/stores/tabs.ts:32` — `openFile()` — add recency update here; `Tab` interface at line 7
- `src/stores/palette.ts:61` — `results` computed — unchanged; `moveSelection:79` — needs `total?` param; return object at line 90 — add `files`, `isHeadingMode`
- `src/components/CommandPalette.vue:41` — `pick()` — needs mode-aware dispatch; `onKeydown:25` — pass `activeItems.length` to moveSelection; template at line 69
- `src/i18n/index.ts:118` — existing `palette.*` keys block

## Tasks & Acceptance

**Execution:**
- [x] `src/stores/tabs.ts` — add `const recentPaths = ref<string[]>([])`. In `openFile()`, splice out existing occurrence of `path`, unshift it, then slice to 20. Add `recentPaths` to the store's return object.
- [x] `src/stores/palette.ts` — add `const isHeadingMode = computed(() => query.value.trimStart().startsWith('#'))`. Change `moveSelection(delta: number)` to `moveSelection(delta: number, total?: number)` using `total ?? results.value.length` as modulo. Add `files` and `isHeadingMode` to the return object.
- [x] `src/i18n/index.ts` — add three keys in the `palette.*` block: `'palette.recent': { en: 'Recent', vi: 'Gần đây' }`, `'palette.headings': { en: 'Headings', vi: 'Tiêu đề' }`, `'palette.noHeadings': { en: 'No headings found', vi: 'Không tìm thấy tiêu đề' }`.
- [x] `src/components/CommandPalette.vue` — add `HeadingHit` interface `{ fileName, filePath, headingText, level }`. Add `recentItems` computed (top-5 from `tabs.recentPaths` mapped via `palette.files.find`, filter defined). Add `headingItems` computed (when `palette.isHeadingMode`, iterate `tabs.tabs`, exec `/^(#{1,6})\s+(.+)/gm` on `tab.content`, filter by query suffix). Add `activeItems` computed: `isHeadingMode → headingItems`, `!query && recents → recentItems`, else `palette.results`. Update `pick(idx)` to dispatch on mode: heading → `openFile(item.filePath, item.fileName)`, else → `openFile(item.path, item.name)`. Update `onKeydown` ArrowUp/Down to call `palette.moveSelection(±1, activeItems.value.length)`. Update template: render `activeItems` with mode-aware item layout (heading: `headingText` primary + `fileName` secondary; file: `name` + `rel_path`). Add section label (`t('palette.recent')` or `t('palette.headings')`) above the list when applicable. Show `t('palette.noHeadings')` empty state when heading mode has no results.

**Acceptance Criteria:**
- Given palette opens and user has opened files this session, when query is empty, then a "Gần đây" section shows up to 5 recently-opened files in recency order (most recent first)
- Given palette opens and no files have been opened this session, when query is empty, then no "Gần đây" section appears and existing top-20 list shows
- Given user types `#`, when palette renders, then it switches to heading mode showing a "Tiêu đề" section with all headings from all open tabs
- Given user types `#intro`, when palette renders, then only headings containing "intro" (case-insensitive) are shown with their source file name as a subtitle
- Given heading mode has no matches, when user types `#zzz`, then "Không tìm thấy tiêu đề" appears
- Given any mode, when user presses ArrowUp/Down, then selection wraps correctly within the current active list without index overflow

## Verification

**Commands:**
- `pnpm typecheck` — expected: no new type errors

## Suggested Review Order

**Recency tracking**

- recentPaths ref + move-to-front logic on every openFile call
  [`tabs.ts:19`](../../src/stores/tabs.ts#L19)

- openFile update: splice, unshift, cap at 20
  [`tabs.ts:33`](../../src/stores/tabs.ts#L33)

**Palette store extensions**

- isHeadingMode computed — query starts with `#` after leading whitespace
  [`palette.ts:61`](../../src/stores/palette.ts#L61)

- moveSelection now accepts optional total; guards against stale results.length
  [`palette.ts:81`](../../src/stores/palette.ts#L81)

**Component — data layer**

- recentItems: top-5 from recentPaths mapped via palette.files, filtered for defined
  [`CommandPalette.vue:21`](../../src/components/CommandPalette.vue#L21)

- headingItems: regex scan of all open tab.content, filtered by query suffix
  [`CommandPalette.vue:29`](../../src/components/CommandPalette.vue#L29)

- activeItems: single source of truth for list + keyboard nav
  [`CommandPalette.vue:48`](../../src/components/CommandPalette.vue#L48)

**Component — pick + nav**

- pick() dispatches on isHeadingMode for correct type cast and openFile args
  [`CommandPalette.vue:86`](../../src/components/CommandPalette.vue#L86)

- ArrowUp/Down pass activeItems.length to moveSelection for correct wrapping
  [`CommandPalette.vue:75`](../../src/components/CommandPalette.vue#L75)

**Peripherals**

- Three new i18n keys: recent, headings, noHeadings labels
  [`index.ts:120`](../../src/i18n/index.ts#L120)
