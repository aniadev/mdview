---
title: 'v1.8.0 — Graph View (S-GV1→S-GV4)'
type: 'feature'
created: '2026-05-22'
status: 'done'
baseline_commit: '293b4867cbb3b4d415a861ba4ee4f52e786dd928'
context:
  - '{project-root}/CLAUDE.md'
  - '{project-root}/_bmad-output/planning-artifacts/breakdown-v1.8.0.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** mdview có wikilink `[[]]` (v1.7) nhưng không cho người dùng nhìn thấy bức tranh tổng thể về mối quan hệ giữa file. Không có cách phát hiện "đảo tài liệu cô lập" hay đo độ kết nối workspace.

**Approach:** Backend Rust scan toàn workspace, parse cả `[[wikilink]]` và `[md](rel.md)` thành `LinkGraph` cache. Frontend thêm sidebar tab "Graph" hiển thị D3.js force simulation interactive — hover highlight, click → mở file, zoom/pan. Cache Rust dùng chung cho v1.8.0 Backlinks follow-up.

## Boundaries & Constraints

**Always:**
- Mọi FS access qua Tauri command (không `@tauri-apps/plugin-fs` từ frontend).
- D3.js **dynamic import** (`await import('d3')`) trong `onMounted` — không bundle vào entry chunk.
- `LinkGraph` cache trong Rust `Mutex<Option<LinkGraph>>` state; invalidate khi roots đổi hoặc `refresh=true`.
- Path normalize backslash → forward slash trước khi so sánh node identity (cross-platform workspace).
- Sidebar view union mở rộng `"graph"`; activity button thêm vào `ExplorerPanel.vue` `.sidebar-activity-row` (KHÔNG phải `Sidebar.vue`).
- i18n cần đủ cả `vi` + `en` keys (xem `src/i18n/index.ts` pattern).
- Multi-thread scan dùng `std::thread::available_parallelism()` — pattern của `search_workspace` (KHÔNG rayon, project không có dep này).

**Ask First:**
- Graph >2000 nodes: warn user, auto-suggest local view.
- Bất kỳ thay đổi nào ảnh hưởng `tabs.ts` / CodeMirror — không nằm trong scope.

**Never:**
- Không scan binary, không follow symlink, bỏ qua `.`-prefix / `node_modules` / `.git`.
- Không persist graph cache xuống disk — memory-only.
- Không real-time file-watcher trong scope này — manual refresh + (optional) debounce sau save.
- Không thêm permission mới (đã có `fs:scope $HOME/**`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Empty workspace | `roots = []` | `LinkGraph { nodes: [], edges: [] }`, GraphPanel empty state | N/A |
| `a.md` chứa `[[b]]` | wiki link basic | edge `{ source: a-abs, target: b-abs, kind: "wiki" }` | b không tồn tại → edge vẫn add với `unresolved: true` |
| `[t](./sub/foo.md#h2)` | md link với heading | edge `kind: "md"`, target resolve abs path | resolve fail → skip, eprintln |
| `[[file\|alias]]` | wiki alias | edge.target = phần trước `\|`, label = alias | N/A |
| Workspace 500 file | full scan | <500ms với multi-thread | file read error → eprintln, skip |
| Click node | UI event | `tabs.openFile(node.path, node.label)` | file missing → toast lỗi |
| `[[fake]]` trong fence ``` | code block | KHÔNG count làm edge | N/A |
| `# heading` line | KHÔNG phải `#tag` | bỏ qua (chỉ chống tag mới được parse, ở đây tag không liên quan) | N/A |
| Roots thay đổi | watch trigger | store auto `refreshGraph(refresh=true)` | error → set `error.value`, không crash |

</frozen-after-approval>

## Code Map

- `src-tauri/src/lib.rs` -- Thêm struct `GraphNode`, `GraphEdge`, `LinkGraph`; thêm `LinkGraphCache` state; thêm command `build_link_graph`; đăng ký vào `invoke_handler![]` + `.manage()`.
- `src/stores/graph.ts` (mới) -- Pinia store: `graph`, `loading`, `error`, `refreshGraph()`, `getLocalGraph()`. Watch `workspace.rootPaths`.
- `src/components/GraphPanel.vue` (mới) -- D3 force-graph SVG component với controls + interactions.
- `src/components/ExplorerPanel.vue` -- Thêm nút `lucide:network` vào `.sidebar-activity-row`, thêm branch `v-else-if="ui.sidebarView === 'graph'"` render `<GraphPanel>`.
- `src/stores/ui.ts` -- Mở rộng `SidebarView` union thêm `"graph"`.
- `src/i18n/index.ts` -- Thêm key `explorer.graph`, `graph.empty`, `graph.loading`, `graph.search`, `graph.localGraph`, `graph.fullGraph`, `graph.refresh`, `graph.tooLarge` (vi + en).
- `package.json` -- Cài `d3` + dev type `@types/d3`. Verify Vite ESM compat.

## Tasks & Acceptance

**Execution:**
- [x] `src-tauri/src/lib.rs` -- Thêm struct: `GraphNode { path: String, label: String, degree: u32 }`, `GraphEdge { source: String, target: String, kind: String, unresolved: bool }`, `LinkGraph { nodes: Vec<GraphNode>, edges: Vec<GraphEdge> }`. Cả 3 derive `Serialize`. Thêm `LinkGraphCache(Mutex<Option<LinkGraph>>)` default; gọi `.manage(LinkGraphCache::default())` trong builder.
- [x] `src-tauri/src/lib.rs` -- Implement `build_link_graph(roots: Vec<String>, refresh: bool, state: State<LinkGraphCache>) -> Result<LinkGraph, String>`. Nếu `!refresh` và cache có sẵn → trả cache. Walk `.md` file giống `list_md_files` (loại trừ `.`-prefix, `node_modules`, `.git`). Parser line-by-line, track `in_fence: bool` toggle khi gặp dòng bắt đầu ```` ``` ````; bỏ qua line khi `in_fence`. Regex: `\[\[([^\]\|#]+)(?:[\|#][^\]]+)?\]\]` cho wiki, `\[([^\]]*)\]\(([^)\s#]+\.md)(?:#[^)]+)?\)` cho md. Resolve relative path so với parent của file đang scan → abs path (canonicalize, fallback raw nếu fail = mark `unresolved`). Build nodes (1 node/file đã touch + 1 node/target unresolved phụ). Compute degree. Multi-thread bằng `std::thread::available_parallelism()` pattern của `search_workspace`. Lưu vào cache. Trả về.
- [x] `src-tauri/src/lib.rs` -- Đăng ký `build_link_graph` vào `invoke_handler![]`.
- [x] `src-tauri/src/lib.rs` -- Unit test (`#[cfg(test)] mod tests`): parser bao phủ fence-exclusion, alias `[[a|b]]`, md-link `[t](./x.md#h)`, unresolved target. Tạo temp dir với `tempfile` crate nếu cần (check `Cargo.toml` xem có sẵn không; nếu không có, skip integration test, chỉ test parser pure function).
- [x] `package.json` -- `pnpm add d3 && pnpm add -D @types/d3`. Verify `pnpm build` không lỗi tree-shake.
- [x] `src/stores/ui.ts` -- Mở rộng `SidebarView` union: `"explorer" | "outline" | "search" | "graph"`.
- [x] `src/stores/graph.ts` (mới) -- Pinia store với state `graph: LinkGraph | null`, `loading: boolean`, `error: string | null`. Action `refreshGraph(force = false)` → `invoke<LinkGraph>("build_link_graph", { roots: workspace.rootPaths, refresh: force })`, set state + try/catch error. Computed `getLocalGraph(filePath, hops=1)` → in-memory filter từ `graph.value`. `watch(() => workspace.rootPaths, () => refreshGraph(true), { deep: true })`.
- [x] `src/components/GraphPanel.vue` (mới) -- Template: `<div class="graph-panel">` chứa toolbar (search input, Local/Full toggle, refresh button) + `<svg ref="svgRef">`. Script: dynamic `const d3 = await import('d3')` trong `onMounted`. Force sim: `d3.forceSimulation(nodes).force('link', d3.forceLink(edges).id((d:any)=>d.path).distance(60)).force('charge', d3.forceManyBody().strength(-200)).force('center', d3.forceCenter(w/2, h/2)).force('collide', d3.forceCollide(20))`. Render node = `<circle>` r based on `Math.sqrt(degree)*3 + 4`, fill color scale theo degree; edge = `<line>` stroke-opacity 0.4. Label `<text>` dưới node. Apply `d3.zoom()` vào `<g>` container. Hover node → set highlight class (CSS: connected edges full opacity, other nodes 0.2). Click node → `tabs.openFile(d.path, d.label)`. Drag với `d3.drag()` fix position khi drag, release on dragend. Empty state, loading spinner, refresh button gọi `graph.refreshGraph(true)`. Search input filter (highlight matching node, dim others). Nếu nodes>2000 hiển thị warning + auto local-only mode. Tất cả text qua i18n.
- [x] `src/components/ExplorerPanel.vue` -- Trong `.sidebar-activity-row`, thêm button thứ 4 sau `'search'` button: icon `lucide:network`, `:title="t('explorer.graph')"`, `:class="{ active: ui.sidebarView === 'graph' }"`, `@click="ui.setSidebarView('graph')"`. Trong sidebar-body, thêm `<GraphPanel v-else-if="ui.sidebarView === 'graph'" />` trước branch `'explorer'` template. Import `GraphPanel` ở top.
- [x] `src/i18n/index.ts` -- Thêm 8 key cho cả `vi` + `en` (`explorer.graph`, `graph.empty`, `graph.loading`, `graph.search`, `graph.localGraph`, `graph.fullGraph`, `graph.refresh`, `graph.tooLarge`).

**Acceptance Criteria:**
- Given workspace 100 file `.md` có wikilink chéo, when mở Graph tab lần đầu, then graph render trong <1s sau khi data load, hiển thị đúng số node/edge.
- Given file `A.md` chứa `[[B]]`, when xem graph, then thấy edge từ A đến B với `kind: "wiki"`.
- Given file md trong code fence chứa `[[fake]]`, when scan, then edge KHÔNG được tạo cho `fake`.
- Given user click node X trong graph, when click, then tab X mở (hoặc activate nếu đã mở).
- Given empty workspace, when mở Graph tab, then hiển thị empty state đúng locale (vi/en).
- Given user toggle Local/Full mode, when toggle, then graph re-render với subset/full data.
- Given user đổi locale trong Settings, when nhìn Graph tab, then mọi label đổi ngôn ngữ.

## Spec Change Log

### 2026-05-22 — step-04 code patches (no spec amendment)

Review surfaced 10 `patch`-category findings. Code-only fixes (frozen contract untouched):

- **Rust cache** keyed by sorted `roots_signature(roots)`; cache returned only when roots match. Closes Always-boundary "invalidate khi roots đổi".
- **Fence parser** tracks opening marker (``` vs ~~~); no toggle on mismatched closing marker. Added test `fence_marker_mismatch_does_not_close_fence`.
- **`resolve_wiki_target`** dropped case-sensitive same-dir branch; lookup via lowercase basename_index only. Trade-off: same-name files in different dirs resolve to FS-order winner (deterministic but not "same-dir-first").
- **`collect_md_files`** allows depth-0 root even when name starts with `.`.
- **`graph.ts`** added `activatedOnce` gate, `inflightId` race guard, watcher uses `rootPaths.join("\n")` (shallow equality).
- **`GraphPanel.vue`** ResizeObserver coalesced to single `requestAnimationFrame`; `activePath` watcher only re-renders in `local` mode.

Defers logged to `deferred-work.md`: URL-decode in MD link target, inline code-span exclusion in parser.

KEEP: parser tests in `src-tauri/src/lib.rs` `mod tests` — golden cases for regression.

## Design Notes

**Code-block exclusion (critical):** parse line-by-line, track `in_fence: bool`. Toggle khi `line.trim_start().starts_with("```")`. Bỏ qua line nếu `in_fence`. Đây là gotcha lớn nhất — regex global sẽ false-positive `[[link]]` trong example code.

**Cache strategy:** memory-only, init `None`. `build_link_graph(refresh=true)` luôn rebuild. `refresh=false` trả cache nếu có. Frontend gọi `refreshGraph(true)` từ: (a) `watch` roots, (b) button "Refresh" trong panel. KHÔNG file-watcher v1.8.0.

**D3 perf threshold:** `nodes.length > 2000` → hiển thị warning + auto-switch local 1-hop. Không kill simulation tự động (user có thể dismiss).

**Why store keeps `LinkGraph` flat (not pre-computed adjacency map):** Backlinks follow-up sẽ cần filter edges by target — flat list scan O(E) chấp nhận được cho workspace dưới vài nghìn link. Không premature optimize.

Golden D3 force-sim skeleton:
```ts
const d3 = await import('d3');
const sim = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(edges).id((d:any) => d.path).distance(60))
  .force('charge', d3.forceManyBody().strength(-200))
  .force('center', d3.forceCenter(w/2, h/2));
sim.on('tick', updateAttrs);
```

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no error.
- `cd src-tauri && cargo check` -- expected: no error.
- `cd src-tauri && cargo clippy -- -D warnings` -- expected: no warning.
- `cd src-tauri && cargo test` -- expected: parser tests pass (fence-exclusion, alias, md-link, unresolved).
- `pnpm build` -- expected: bundle thành công; verify D3 ở chunk riêng (`dist/assets/d3-*.js`), không nằm trong entry.

**Manual checks:**
- `pnpm tauri:dev`, mở workspace test có ~10 file md với link chéo. Mở Graph tab → node hiển thị, hover highlight đúng, click → mở file. Toggle Local/Full → graph re-render. Đổi locale → text đổi. Empty workspace → empty state.

## Suggested Review Order

**Rust: link parser + graph builder (entry point)**

- Pure parser. Fence marker tracking + wiki/md regex per-line, line numbers preserved.
  [`lib.rs:474`](../../src-tauri/src/lib.rs#L474)

- Graph assembly. Multi-thread file scan, basename index lookup, node/edge dedup, degree count.
  [`lib.rs:583`](../../src-tauri/src/lib.rs#L583)

- Tauri command + cache. `roots_signature` keys cache so non-force calls still rebuild on roots change.
  [`lib.rs:717`](../../src-tauri/src/lib.rs#L717)

- Roots signature helper. Sorted+joined string for order-independent cache key.
  [`lib.rs:445`](../../src-tauri/src/lib.rs#L445)

- Workspace walker. Allows depth-0 root entry even when name starts with `.`.
  [`lib.rs:521`](../../src-tauri/src/lib.rs#L521)

- Wiki resolve. Simplified to lowercase basename lookup (cross-platform consistent).
  [`lib.rs:553`](../../src-tauri/src/lib.rs#L553)

**TypeScript store bridge**

- Pinia store with `activatedOnce` gate + `inflightId` race guard + shallow-equality roots watcher.
  [`graph.ts:25`](../../src/stores/graph.ts#L25)

- Local subgraph extraction (BFS hops). Used by GraphPanel local-mode.
  [`graph.ts:65`](../../src/stores/graph.ts#L65)

- Sidebar view union extended with `"graph"`.
  [`ui.ts:6`](../../src/stores/ui.ts#L6)

**D3 visualization**

- Render function. Dynamic d3 import, force sim (link/charge/center/collide), zoom/pan, hover-highlight, click→openFile.
  [`GraphPanel.vue:64`](../../src/components/GraphPanel.vue#L64)

- Resize throttle. Single `requestAnimationFrame`, skip re-render if dims unchanged.
  [`GraphPanel.vue:261`](../../src/components/GraphPanel.vue#L261)

- `activePath` watcher gated to local mode only (avoids wasted re-renders).
  [`GraphPanel.vue:299`](../../src/components/GraphPanel.vue#L299)

- Effective mode forces `local` when `>2000` nodes.
  [`GraphPanel.vue:34`](../../src/components/GraphPanel.vue#L34)

**Sidebar integration + i18n**

- Activity button (`lucide:network`) + render branch.
  [`ExplorerPanel.vue:333`](../../src/components/ExplorerPanel.vue#L333)

- GraphPanel mount on `sidebarView === 'graph'`.
  [`ExplorerPanel.vue:394`](../../src/components/ExplorerPanel.vue#L394)

- 8 new i18n keys (vi+en).
  [`index.ts:161`](../../src/i18n/index.ts#L161)

**Tests**

- Parser regression suite (12 tests): fence/alias/md-link/mismatch/roots-signature.
  [`lib.rs:1233`](../../src-tauri/src/lib.rs#L1233)
