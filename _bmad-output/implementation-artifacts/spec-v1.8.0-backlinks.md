---
title: 'v1.8.0 Backlinks Panel'
type: 'feature'
created: '2026-05-22'
status: 'done'
baseline_commit: 'cc726f6840a797c3a508a2af7eda50d73f19da1c'
context:
  - '{project-root}/CLAUDE.md'
  - '{project-root}/_bmad-output/planning-artifacts/breakdown-v1.8.0.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Wikilink `[[note]]` và md link `[t](./note.md)` đã có nhưng không có cách xem **file nào đang link đến** note hiện tại. Graph View vừa ship (`cc726f6`) đã có `LinkGraphCache` chứa edges, chưa khai thác. Mảnh ghép cuối Knowledge Graph epic (S-BL1→S-BL3).

**Approach:** Thêm Rust command `find_backlinks` tận dụng `LinkGraphCache` (build nếu cold). Tạo `BacklinksPanel.vue` liệt kê inbound link + context snippet + line; nhúng vào cuối `PreviewPane.vue` (dưới `.markdown-body`, cùng scroll container — Obsidian-style). Click entry → `tabs.openFile`.

## Boundaries & Constraints

**Always:**
- Tái sử dụng `LinkGraphCache` (Mutex). Không scan workspace song song với Graph View.
- Path normalize: `norm_slashes` + canonicalize → khớp `edge.target` đã slash-absolute.
- Async fetch, không block markdown render. Stale-guard bằng `inflightId` (pattern từ `graph.ts`).

**Ask First:**
- Đổi sang sidebar tab thay vì cuối PreviewPane.
- Sửa schema `GraphEdge` (thêm `line_number`) — ảnh hưởng Graph View.

**Never:**
- KHÔNG sửa `GraphEdge` / `LinkGraph` struct (Graph View đã ship dùng).
- KHÔNG rescan workspace/query — phải đi cache.
- KHÔNG xử lý percent-encoded link (defer).
- KHÔNG thêm Vue file ngoài `BacklinksPanel.vue`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Behavior | Error |
|---|---|---|---|
| Happy | `B.md` mở, `A.md:[[B]]`, `C.md:[t](./B.md)` | 2 entry (wiki+md), line + snippet ≤3 dòng | N/A |
| No backlink | File không trong `edge.target` | Empty state `t('backlinks.empty')` | N/A |
| Cache cold | Graph chưa build | `find_backlinks` build cache transparently | Loading ≤1.5s |
| Source unreadable | `read_to_string` fail | Skip entry, `eprintln!` | Omit |
| Windows path | `C:\path\B.md` | Normalize → match | N/A |
| Tab switch giữa fetch | User đổi tab khi pending | `inflightId` discard stale | N/A |
| Click entry | `A.md` line 5 | `tabs.openFile`, activate | console.error |

</frozen-after-approval>

## Code Map

- `src-tauri/src/lib.rs` -- thêm `BacklinkEntry` struct + `find_backlinks` command. Reuse `LinkGraphCache`, `parse_links_in_text`, `collect_md_files`, `resolve_wiki_target`, `resolve_md_target`, `norm_slashes`, `roots_signature`, `build_graph_impl`.
- `src/components/BacklinksPanel.vue` -- new component.
- `src/components/PreviewPane.vue` -- nhúng panel dưới `.markdown-body`.
- `src/i18n/index.ts` -- 6 i18n key.

## Tasks & Acceptance

**Execution:**
- [x] `src-tauri/src/lib.rs` -- thêm `BacklinkEntry { from_file: String, from_label: String, link_type: String, line_number: usize, context: String }` (Serialize, Clone). `link_type` ∈ `"wiki"|"md"`.
- [x] `src-tauri/src/lib.rs` -- `#[tauri::command] fn find_backlinks(file_path, roots, state: State<LinkGraphCache>) -> Result<Vec<BacklinkEntry>, String>`. Logic: normalize+canonicalize file_path → target_key. Lấy graph từ cache (match `roots_signature`); miss → `build_graph_impl` + cache. Filter `graph.edges` nơi `edge.target == target_key`, thu unique source paths. Mỗi source: `read_to_string`, `parse_links_in_text`, lọc ParsedLink resolve về target_key, emit entry với `context = lines[i-1..=i+1].join("\n")` (clamp biên).
- [x] `src-tauri/src/lib.rs` -- register `find_backlinks` trong `invoke_handler![]` sau `build_link_graph`.
- [x] `src-tauri/src/lib.rs` -- unit test: happy (wiki+md cùng target), no-backlink, missing source file (skip), Windows path normalize.
- [x] `src/i18n/index.ts` -- thêm `backlinks.title|empty|loading|linkedFrom|wikilink|mdLink` (en+vi).
- [x] `src/components/BacklinksPanel.vue` -- `defineProps<{ filePath: string }>()`. Watch `filePath` debounce 100ms, invoke `find_backlinks` với `useWorkspaceStore().rootPaths`. State: `loading | error | entries`. Render: title + list. Mỗi entry: icon (`lucide:link-2` wiki / `lucide:external-link` md) + `from_label` + `:L<line>` + context `<pre>`. Click → `tabs.openFile(from_file, label)`. Stale guard `inflightId`. Empty state.
- [x] `src/components/PreviewPane.vue` -- import `BacklinksPanel`; render `<BacklinksPanel v-if="!isEmpty && props.filePath" :file-path="props.filePath" />` ngay sau `<div class="markdown-body">` (cùng `.preview-pane`). CSS: `border-top: 1px solid var(--border); margin-top: 32px; padding-top: 16px;`.

**Acceptance Criteria:**
- Given `A.md:[[B]]` + `C.md:[t](./B.md)` trong workspace, when mở `B.md`, then Backlinks dưới preview liệt kê 2 entry đúng line + snippet 1–3 dòng.
- Given file không có inbound link, when panel render, then empty state `t('backlinks.empty')`.
- Given click entry, when entry là `A.md`, then tab `A.md` active (open hoặc switch).
- Given Graph View chưa từng mở (cache cold) + workspace 500 files, when mở file có backlink lần đầu, then build cache transparently + render ≤1.5s.
- Given đổi tab nhanh `B↔D` trong 200ms, when fetch B pending, then UI hiện backlinks của D (không stale B).
- Given `pnpm typecheck` + `cd src-tauri && cargo clippy --workspace -- -D warnings`, then no new errors/warnings.

## Spec Change Log

<!-- empty -->

## Design Notes

**Cache reuse (Rust):**
```rust
let key = roots_signature(&roots);
let graph = {
    let g = state.0.lock().map_err(|e| e.to_string())?;
    g.as_ref().filter(|c| c.roots_key == key).map(|c| c.graph.clone())
};
let graph = graph.unwrap_or_else(|| {
    let g = build_graph_impl(collect_md_files(&roots));
    *state.0.lock().unwrap() = Some(CachedGraph { roots_key: key, graph: g.clone() });
    g
});
```

**Context snippet:** sau khi xác định `line` (1-based) từ `ParsedLink.line`, lấy `lines.get(line.saturating_sub(2)..=line.min(len-1))` join `\n`, rtrim. Re-read O(N) với N ≤ backlink count (thường ≤20) — chấp nhận được, không cache vì context phụ thuộc file mtime.

## Verification

**Commands:**
- `pnpm typecheck` — 0 errors.
- `cd src-tauri && cargo check` — pass.
- `cd src-tauri && cargo clippy --workspace -- -D warnings` — 0 warnings.
- `cd src-tauri && cargo test find_backlinks` — all pass.
- `pnpm tauri:dev` — launch ok.

**Manual checks:**
- Workspace có ≥3 file cross-link → mở B → thấy backlinks A + C.
- Click entry → tab nguồn active.
- File không backlink → empty state.
- Đổi tab nhanh — không thấy stale entries.

## Suggested Review Order

**Rust backend — backlinks command**

- Entry point: command shape, cache reuse, target-key normalize.
  [`lib.rs:826`](../../src-tauri/src/lib.rs#L826)

- Per-source re-parse + 3-line snippet window with bounds hardening.
  [`lib.rs:768`](../../src-tauri/src/lib.rs#L768)

- Full-graph basename index → avoids basename-collision false positives.
  [`lib.rs:754`](../../src-tauri/src/lib.rs#L754)

- Serialized payload shape returned to frontend.
  [`lib.rs:746`](../../src-tauri/src/lib.rs#L746)

**Frontend — panel + integration**

- Watch `filePath` (immediate + 100ms debounce), `inflightId` + `unmounted` stale guards.
  [`BacklinksPanel.vue:30`](../../src/components/BacklinksPanel.vue#L30)

- Cleanup on unmount: clear timer, latch `unmounted`.
  [`BacklinksPanel.vue:74`](../../src/components/BacklinksPanel.vue#L74)

- Embedded inside `.preview-pane` after `.markdown-body`, shares scroll.
  [`PreviewPane.vue:437`](../../src/components/PreviewPane.vue#L437)

**Tests + i18n**

- Backlink unit tests: happy / no-link / missing source / 3-line window / backslash-normalize / basename collision.
  [`lib.rs:1480`](../../src-tauri/src/lib.rs#L1480)

- New i18n keys (en + vi) for title / empty / loading / linkedFrom / link kind labels.
  [`i18n/index.ts:171`](../../src/i18n/index.ts#L171)

- Command handler registration.
  [`lib.rs:1318`](../../src-tauri/src/lib.rs#L1318)
