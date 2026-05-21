---
title: 'Wikilink [[]] Autocomplete in Editor'
type: 'feature'
created: '2026-05-21'
status: 'done'
baseline_commit: '31a12d321bb3d72bc7734cd763d7c56b1086103f'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Typing `[[` in the editor produces no UI assistance for linking to other files in the workspace. Users must remember exact filenames and type them manually.

**Approach:** Create a CodeMirror 6 completion source in `src/extensions/wikilinkCompletion.ts` that triggers when the cursor is inside an unclosed `[[`. The source reads from `palette.files` (already populated by App.vue on mount) and presents filenames as completions. Selecting inserts `[[filename]]` (without .md extension). Register the extension in `SourceEditor.vue`'s `build()` function.

## Boundaries & Constraints

**Always:**
- Trigger only when cursor matches `/\[\[[^\]]*$/` immediately before it — no trigger outside `[[` context
- Insert `label + ']]'` where `label` is the filename without `.md` extension
- Source reads `palette.files` via a getter `() => MdFile[]` injected by `SourceEditor.vue` — extension itself must not import stores directly (keeps it testable and reusable)
- Completion popup appears as soon as `[[` is typed (even with empty query after `[[`)
- Use `@codemirror/autocomplete`'s built-in popup UI — no custom popup component
- `from` of the completion result = position immediately after `[[` so CM6's built-in filter works on the typed suffix

**Ask First:**
- N/A

**Never:**
- Do not implement scroll-to-heading or wikilink resolution/navigation — only insertion
- Do not replace existing CM6 extensions in `SourceEditor.vue` — add alongside
- Do not add a separate Tauri command — `palette.files` is sufficient; no new Rust needed
- Do not strip `.md` from filenames that don't end in `.md`

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| User types `[[` | cursor at `[[|` | Completion popup appears listing all workspace files | N/A |
| User types `[[note` | cursor at `[[note|` | Popup shows only files with "note" in name (CM6 filter) | N/A |
| User selects completion | picks "notes.md" | Inserts `notes]]` → result: `[[notes]]` | N/A |
| `palette.files` empty | no workspace loaded | `source` returns null — no popup, no error | N/A |
| Already closed `[[foo]]` | cursor after `]]` | No trigger — regex requires unclosed `[[` | N/A |
| Explicit trigger `Ctrl+Space` | cursor not inside `[[` | No completions (source returns null) | N/A |

</frozen-after-approval>

## Code Map

- `src/components/SourceEditor.vue:72-139` — `build()` function; extensions array at ~74-83; no stores imported yet
- `src/stores/palette.ts:6-10` — `MdFile` interface (`name`, `path`, `rel_path`); `files` now exposed
- `package.json:42-48` — `@codemirror/*` packages; `@codemirror/autocomplete` not yet installed

## Tasks & Acceptance

**Execution:**
- [x] `package.json` — install `@codemirror/autocomplete` via `pnpm add @codemirror/autocomplete`
- [x] `src/extensions/wikilinkCompletion.ts` — create new file. Export `wikilinkCompletion(getFiles: () => MdFile[]): Extension`. Inside, define `source(context: CompletionContext): CompletionResult | null` — match `/\[\[[^\]]*$/` before cursor; if no match return null; map `getFiles()` to CM6 `Completion[]` with `label = name.replace(/\.md$/i, '')`, `detail = rel_path`, and `apply` function that dispatches `{ from, to, insert: label + ']]' }`; return `{ from: match.from + 2, options, filter: true }`. Return `autocompletion({ override: [source] })`.
- [x] `src/components/SourceEditor.vue` — import `wikilinkCompletion` from `../extensions/wikilinkCompletion`; import `usePaletteStore`; instantiate `const palette = usePaletteStore()`; in `build()` extensions array add `wikilinkCompletion(() => palette.files)`.

**Acceptance Criteria:**
- Given a workspace with .md files is loaded, when user types `[[` in the editor, then a completion popup appears listing workspace files
- Given popup is open, when user continues typing (e.g. `[[note`), then the list filters to files matching "note"
- Given user selects a completion, when Enter or click is pressed, then the editor contains `[[filename]]` with no `.md` extension
- Given `palette.files` is empty (no workspace), when user types `[[`, then no popup appears and no error is thrown
- Given cursor is outside `[[` context, when user presses Ctrl+Space, then no wikilink popup appears

## Verification

**Commands:**
- `pnpm typecheck` — expected: no new type errors
- `cargo check --manifest-path src-tauri/Cargo.toml` — expected: unchanged

## Suggested Review Order

**Extension entry point**

- Trigger regex: matches `[[` + non-`]` chars ending at cursor; no false positives
  [`wikilinkCompletion.ts:8`](../../src/extensions/wikilinkCompletion.ts#L8)

- from offset skips `[[` so CM6 filter works on the typed suffix only
  [`wikilinkCompletion.ts:23`](../../src/extensions/wikilinkCompletion.ts#L23)

- apply replaces `[from, to]` with `label + ']]'`; label has .md stripped
  [`wikilinkCompletion.ts:17`](../../src/extensions/wikilinkCompletion.ts#L17)

- autocompletion override: only wikilink source, no default CM6 completions
  [`wikilinkCompletion.ts:26`](../../src/extensions/wikilinkCompletion.ts#L26)

**Registration in editor**

- Getter `() => palette.files` — reads current files on each keystroke, lazy by design
  [`SourceEditor.vue:86`](../../src/components/SourceEditor.vue#L86)
