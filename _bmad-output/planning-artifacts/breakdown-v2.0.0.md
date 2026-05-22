---
title: "mdview v2.0.0 — Feature Breakdown"
version: 2.0.0
created: 2026-05-23
status: draft
---

# v2.0.0 Feature Breakdown

Chủ đề: **"Collaboration & Intelligence"** — biến mdview từ editor cá nhân thành workspace có khả năng đồng bộ GitHub không cần biết git + AI đồng hành trong từng tài liệu qua hai lối vào: Tier 0 (zero setup, dùng ChatGPT/Claude web) và Tier 1 (API key miễn phí, AI context-aware).

**Persona mục tiêu:** BA, CEO, nhà nghiên cứu — người làm việc với tài liệu chuyên sâu nhưng không muốn học git CLI hay rời app để hỏi AI.

**Prerequisite:** v1.8.0 (Graph View, Backlinks, Frontmatter, Templates) đã ship.

---

## 0. PROBLEM DISCOVERY: Why v2.0.0

### 0.1 The BA/CEO Git Problem

Người dùng phi kỹ thuật làm việc với tài liệu markdown trong workspace cần chia sẻ và đồng bộ với team qua GitHub, nhưng:

| Pain Point | Hiện trạng | Hậu quả |
|---|---|---|
| Không biết git | Terminal có sẵn nhưng phải gõ lệnh | Không dùng được, phải nhờ dev |
| Sợ mất dữ liệu | Không có diff visual trước khi push | Lo lắng khi "sync" |
| Không biết ai sửa gì | `git log` quá kỹ thuật | Mất visibility về thay đổi của team |
| Conflict là ác mộng | Merge conflict cần giải quyết thủ công | Từ bỏ, copy-paste thủ công |
| Setup repo phức tạp | Clone, remote, branch... | Không bắt đầu được |

**Cần:** Git workflow simplified — "Save & Share" thay vì "commit & push".

### 0.2 The AI Gap

Người dùng làm tài liệu thường xuyên cần:

| Nhu cầu | Hiện trạng | Workaround |
|---------|-----------|------------|
| Tóm tắt tài liệu dài | Không có | Copy-paste sang ChatGPT |
| Tìm mối liên hệ giữa các note | Không có | Đọc thủ công |
| Cải thiện văn phong đoạn văn | Không có | Rời app |
| Soạn thảo từ bullet points | Không có | Rời app |
| Hỏi về nội dung workspace | Không có | Không làm được |
| Dịch tài liệu | Không có | Rời app |

**Hai rào cản chính cho BA/CEO:**
1. **Không biết API key là gì** — đã quen ChatGPT/Claude web, không muốn học khái niệm mới
2. **Không muốn trả phí** — API trả phí (OpenAI, Anthropic) là rào cản tâm lý

**Giải pháp hai tầng:**
- **Tier 0 — "Send to Web AI":** Zero setup, dùng ChatGPT/Claude/Gemini web như cũ. App hỗ trợ copy-paste thông minh.
- **Tier 1 — Free API Key:** Google AI Studio & Groq miễn phí, lấy key trong 2 phút. AI context-aware, inline edit, streaming.

---

## 1. PILLAR A: Git Made Simple — "Save & Share"

### 1.1 Design Philosophy

**Nguyên tắc cốt lõi:**
- Không dùng từ "commit", "push", "pull", "branch", "merge", "rebase", "staging"
- Thay bằng: "Save Version", "Share", "Get Updates", "History"
- Không yêu cầu người dùng biết git
- Visual diff trước mọi thao tác
- Conflict resolution có guided UI, không phải text editor
- Auto-setup: phát hiện git repo hoặc giúp tạo mới

**Từ điển thuật ngữ (Git → Người dùng):**

| Git Term | User-Facing Term | Icon |
|----------|-----------------|------|
| Working directory changes | "Unsaved Changes" | lucide:circle-dot |
| Stage | (hidden — auto-stage all) | — |
| Commit | "Save Version" | lucide:git-commit |
| Push | "Share with Team" | lucide:upload |
| Pull / Fetch | "Get Team Updates" | lucide:download |
| Branch | (hidden — default branch only) | — |
| Merge conflict | "Update Conflict — Let's Fix It" | lucide:git-merge |
| Remote | "GitHub" (hard-coded for simplicity) | lucide:github |
| Clone | "Open from GitHub" | lucide:cloud-download |
| git log | "Version History" | lucide:history |

### 1.2 Architecture

```
┌─ Rust Backend (git2-rs) ────────────────────┐
│                                               │
│  git_status(path) → GitStatus                │
│    ├─ modified: Vec<String>                   │
│    ├─ new_files: Vec<String>                  │
│    ├─ deleted: Vec<String>                    │
│    └─ ahead/behind: Option<(u32, u32)>       │
│                                               │
│  git_save_version(path, message)              │
│    ├─ stage all changes                       │
│    ├─ commit with message                     │
│    └─ return commit hash                      │
│                                               │
│  git_share(path) → PushResult                │
│    ├─ push to remote                          │
│    └─ report success/conflict                 │
│                                               │
│  git_get_updates(path) → PullResult          │
│    ├─ fetch + merge/rebase                    │
│    └─ report new commits / conflicts          │
│                                               │
│  git_history(path) → Vec<HistoryEntry>        │
│    ├─ commits with author, date, message     │
│    └─ list of changed files per commit        │
│                                               │
│  git_diff(path, commit1, commit2) → String   │
│    └─ unified diff format                     │
│                                               │
│  git_clone(url, dest) → Path                  │
│    └─ clone GitHub repo to local              │
│                                               │
│  git_init_and_connect(path, remote_url)       │
│    ├─ git init                                 │
│    ├─ create initial commit                    │
│    └─ add remote + push                        │
│                                               │
│  git_resolve_conflict(path, choice)            │
│    ├─ mark as resolved (ours/theirs)          │
│    └─ continue merge                           │
└───────────────────────────────────────────────┘
```

### 1.3 UI Components

#### 1.3.1 Git Status Bar

Thanh trạng thái nhỏ ở bottom của app (hoặc sidebar section), luôn hiển thị:

```
🟢 Up to date with GitHub                     [Share] [Get Updates]
🔵 3 unsaved changes • 2 files                  [Save Version ▼]
🟡 You're ahead by 2 versions. Last shared 1h ago  [Share Now]
🔴 5 team updates available                         [Get Updates]
⚪ Working folder (not connected to GitHub)          [Connect...]
```

#### 1.3.2 File Tree Git Badges

Trên `FileTreeNode`:

| Status | Badge |
|--------|-------|
| Modified (M) | 🔵 dot cạnh tên file |
| New (untracked) | 🟢 dot + chữ "new" |
| Deleted (D) | ⚪ strike-through |
| In conflict | 🔴 "!" badge |
| Staged/Ahead | Không hiển thị (auto-stage) |

#### 1.3.3 Save Version Dialog

Thay vì commit message phức tạp, dialog đơn giản:

```
┌──────────────────────────────────────┐
│  Save Version                        │
│                                      │
│  What did you change?                │
│  ┌────────────────────────────────┐  │
│  │ Updated requirements doc       │  │
│  │ for Q3 planning                │  │
│  └────────────────────────────────┘  │
│                                      │
│  Files included (3):                 │
│  ✓ requirements/q3-scope.md          │
│  ✓ notes/meeting-2026-05-22.md       │
│  ✓ README.md                         │
│                                      │
│              [Cancel]  [Save Version] │
└──────────────────────────────────────┘
```

#### 1.3.4 Version History Panel

Sidebar tab hiển thị lịch sử phiên bản dạng timeline thân thiện:

```
▼ Today
  ├─ 14:30  Ania  "Updated Q3 scope with budget numbers"
  │         2 files changed
  ├─ 10:15  Ania  "Added meeting notes from stakeholder review"
  │         1 file changed
▼ Yesterday
  ├─ 16:45  Mike  "Revised architecture decision log"
  │         3 files changed
  ...
```

Click một version → mở diff view (highlight inline thay đổi).

#### 1.3.5 Conflict Resolution UI

Khi có conflict sau "Get Team Updates":

```
┌──────────────────────────────────────────────┐
│  ⚠ Update Conflict — Let's Fix It            │
│                                              │
│  File: requirements/q3-scope.md              │
│                                              │
│  ┌─ Your Version ────────┐ ┌─ Team Version ──┐
│  │ Budget: $500,000      │ │ Budget: $750,000 │
│  │ Timeline: Q3 2026     │ │ Timeline: Q4 2026│
│  └────────────────────────┘ └─────────────────┘
│                                              │
│  Keep:  ○ Your Version   ● Team Version      │
│                                              │
│              [Skip]  [Keep Both]  [Confirm]  │
└──────────────────────────────────────────────┘
```

### 1.4 Stories — Pillar A

#### S-GT1 — Rust: `git2` Dependency + Core Commands
* **Goal:** Thêm `git2` crate và implement các command git cơ bản.
* **Scope:**
  - Thêm `git2 = "0.19"` vào `Cargo.toml`.
  - Implement trong `src-tauri/src/git.rs` (module riêng):
    - `open_repo(path) -> Result<Repository>` — mở git repo, xử lý parent traversal
    - `git_status(path) -> GitStatus` — status file (modified, new, deleted) + ahead/behind count
    - `git_save_version(path, message) -> CommitResult` — stage all + commit
    - `git_share(path) -> PushResult` — push to default remote
    - `git_get_updates(path) -> PullResult` — pull (fetch + merge với fast-forward ưu tiên)
    - `git_history(path, limit) -> Vec<HistoryEntry>` — commit log với changed files
    - `git_diff(path, commit1?, commit2?) -> DiffResult` — diff giữa commits hoặc working tree
  - Register all commands trong `invoke_handler![]`.
  - Update `default.json` capabilities (không cần scope mới — git2 hoạt động qua filesystem).
* **Complexity:** Cao (Rust — git2 API learning curve)
* **Dependency:** `git2` crate (~2MB compiled)

#### S-GT2 — Rust: `git_init`, `git_clone`, Conflict Resolution
* **Goal:** Các command nâng cao: khởi tạo repo, clone, giải quyết conflict.
* **Scope:**
  - Implement trong `src-tauri/src/git.rs`:
    - `git_init_and_connect(path, remote_url) -> Result<Path>` — init + initial commit + add remote + push
    - `git_clone(url, dest) -> Result<Path>` — clone repo, hỗ trợ progress callback
    - `git_check_conflicts(path) -> Vec<ConflictFile>` — liệt kê file đang conflict
    - `git_resolve_conflict(path, file, choice) -> Result` — resolve bằng ours/theirs
    - `git_abort_merge(path) -> Result` — hủy merge đang dang dở
  - `ConflictChoice` enum: `KeepOurs`, `KeepTheirs`, `KeepBoth`
  - Register commands.
* **Complexity:** Trung bình–Cao

#### S-GT3 — Store: `git.ts`
* **Goal:** Pinia store quản lý git state, polling status.
* **Scope:**
  - Tạo `src/stores/git.ts`:
    - State: `isRepo: boolean`, `status: GitStatus | null`, `history: HistoryEntry[]`, `loading`, `error`
    - Method `refreshStatus()` — gọi `git_status`
    - Method `saveVersion(message)` — gọi `git_save_version`
    - Method `share()` — gọi `git_share`, tự động pull trước nếu behind
    - Method `getUpdates()` — gọi `git_get_updates`
    - Method `loadHistory()` — gọi `git_history`
    - Polling: tự động `refreshStatus()` mỗi 30s nếu có workspace và là git repo
    - Watch `tabs.activePath` để refresh status sau khi save file
  - Computed: `hasUnsavedChanges`, `aheadCount`, `behindCount`, `conflictFiles`, `statusSummary`
* **Complexity:** Trung bình

#### S-GT4 — Component: `GitStatusBar.vue`
* **Goal:** Thanh trạng thái git ở bottom của app, luôn visible.
* **Scope:**
  - Tạo `src/components/GitStatusBar.vue`:
    - Hiển thị theo state: "Up to date", "N unsaved changes", "Ahead by X", "Behind by Y", "Conflicts", "No repo"
    - Action buttons ngữ cảnh: "Save Version", "Share", "Get Updates", "Connect to GitHub"
    - Vị trí: Dưới cùng của `App.vue`, bên phải (cạnh theme toggle, status info)
    - Responsive: ẩn text khi width hẹp, chỉ hiện icon + badge number
  - i18n keys: `git.upToDate`, `git.unsavedChanges`, `git.ahead`, `git.behind`, `git.conflicts`, `git.noRepo`, `git.connect`
* **Complexity:** Thấp

#### S-GT5 — Component: `SaveVersionDialog.vue`
* **Goal:** Dialog đơn giản để mô tả thay đổi và lưu version.
* **Scope:**
  - Tạo `src/components/SaveVersionDialog.vue` (dùng shadcn Dialog):
    - Textarea "What did you change?" (placeholder: "Updated requirements for Q3...")
    - Danh sách file sẽ được include (auto-detected từ git status)
    - Nút "Save Version" → `git.saveVersion()` → `git.share()` nếu user check "Also share with team"
    - Keyboard: `Cmd+Enter` để save
  - i18n keys: `git.saveTitle`, `git.savePlaceholder`, `git.saveFilesIncluded`, `git.saveAndShare`
* **Complexity:** Thấp

#### S-GT6 — Component: `VersionHistoryPanel.vue`
* **Goal:** Timeline lịch sử phiên bản dạng thân thiện, với khả năng xem diff.
* **Scope:**
  - Tạo `src/components/VersionHistoryPanel.vue`:
    - Timeline grouped by ngày (Today, Yesterday, <date>)
    - Mỗi entry: author avatar/name, time, message, file count
    - Click → expand hiển thị danh sách file changed + nút "View Changes"
    - "View Changes" → mở `DiffViewDialog` với side-by-side hoặc unified diff
    - Lazy load: load 20 entries, scroll-to-bottom load thêm
  - i18n keys: `git.historyTitle`, `git.historyToday`, `git.historyYesterday`, `git.viewChanges`
* **Complexity:** Trung bình

#### S-GT7 — Component: `DiffViewDialog.vue` + `ConflictResolver.vue`
* **Goal:** Hiển thị diff trực quan và guided conflict resolution.
* **Scope:**
  - Tạo `src/components/DiffViewDialog.vue`:
    - Render unified diff với syntax highlighting (thêm/xóa/sửa)
    - Sử dụng thư viện `diff` (npm) hoặc tự code CSS highlight
    - Side-by-side mode (tùy chọn) cho màn hình rộng
    - Scroll sync giữa 2 panel
  - Tạo `src/components/ConflictResolver.vue`:
    - Hiển thị file conflict với 2 cột: "Your Version" / "Team Version"
    - Radio button chọn: Keep Yours, Keep Theirs, Keep Both
    - Nút "Next Conflict" / "Resolve All"
    - Sau khi resolve hết → tự động commit merge
  - i18n keys: `git.diffTitle`, `git.conflictTitle`, `git.conflictKeepYours`, `git.conflictKeepTheirs`, `git.conflictKeepBoth`
* **Complexity:** Cao (diff rendering + conflict UX)

#### S-GT8 — File Tree Git Badges + Connect Flow
* **Goal:** Hiển thị git status badge trên file tree và flow kết nối GitHub.
* **Scope:**
  - `FileTreeNode.vue`: Thêm span badge dựa trên `git.status` map theo file path
  - CSS cho các loại badge (modified dot, new dot, conflict marker)
  - `ExplorerPanel.vue`: Thêm nút "Connect to GitHub" khi workspace chưa là git repo
  - Flow "Connect to GitHub":
    1. Dialog hỏi: GitHub repo URL (hoặc "Create new repo on GitHub")
    2. Option: tạo repo mới qua GitHub API (cần PAT) hoặc connect repo có sẵn
    3. Gọi `git_init_and_connect` hoặc `git_clone`
  - i18n keys: `git.connectTitle`, `git.connectUrl`, `git.connectCreate`, `git.connectClone`
* **Complexity:** Trung bình

---

## 2. PILLAR B: AI Assistant — Two-Tier Strategy

### 2.1 Design Philosophy

**Hai lối vào cho hai đối tượng người dùng:**

| Tier | Tên | Đối tượng | Setup | Context |
|------|-----|-----------|-------|---------|
| **Tier 0** | "Send to Web AI" | Mọi người dùng, kể cả BA/CEO không biết API key | Zero | ❌ Copy-paste thủ công |
| **Tier 1** | Free API + Full AI | Người dùng sẵn sàng dành 2 phút lấy key miễn phí | 2 phút | ✅ Context-aware tự động |

**Nguyên tắc cốt lõi:**
- **Tier 0 luôn hoạt động** — không cần setup, fallback cho mọi user
- **Tier 1 là giá trị thật** — AI context-aware, inline edit, streaming
- **Không yêu cầu API key trả phí** — Google AI Studio free tier và Groq đều miễn phí generous
- **Streaming response**: Hiển thị từng token như ChatGPT (Tier 1)
- **Action-oriented**: Không chỉ chat — AI có thể insert/edit nội dung vào editor (Tier 1)

### 2.2 Tier 0: "Send to Web AI" — Zero Setup

#### 2.2.1 User Flow

```
Người dùng đang edit file q3-scope.md
    │
    ├─ Chọn đoạn văn về "Budget"
    │
    ├─ Click nút "Ask AI About This" (trong toolbar)
    │   │
    │   ▼
    │   ┌──────────────────────────────────────┐
    │   │  Send to Web AI                      │
    │   │                                      │
    │   │  I'll format your text and open      │
    │   │  your AI tool in the browser.        │
    │   │                                      │
    │   │  Template:                           │
    │   │  ┌────────────────────────────────┐  │
    │   │  │ Summarize this in 3 bullet     │  │
    │   │  │ points:                        │  │
    │   │  │ ...selected text...             │  │
    │   │  └────────────────────────────────┘  │
    │   │                                      │
    │   │  Open in:                             │
    │   │  [ChatGPT ↗]  [Claude ↗]  [Gemini ↗] │
    │   │                                      │
    │   │  ☐ Remember this template            │
    │   └──────────────────────────────────────┘
    │
    ├─ Browser mở chat.openai.com
    │  (Nội dung đã được copy vào clipboard)
    │
    ├─ Người dùng Ctrl+V paste → chat với AI
    │
    └─ Quay lại mdview → bấm "Paste AI Response"
       │
       ▼
       ┌──────────────────────────────────────┐
       │  Paste AI Response                   │
       │                                      │
       │  ┌────────────────────────────────┐  │
       │  │ (paste kết quả từ ChatGPT)     │  │
       │  └────────────────────────────────┘  │
       │                                      │
       │  [Insert at Cursor]  [Replace]       │
       └──────────────────────────────────────┘
```

#### 2.2.2 Prompt Template Library

Người dùng không cần nghĩ prompt — chọn từ thư viện có sẵn:

| Template | Mục đích |
|----------|----------|
| "Summarize this in 3 bullet points: {text}" | Tóm tắt nhanh |
| "Extract action items and decisions from: {text}" | Từ meeting notes |
| "Improve the writing clarity and grammar of: {text}" | Soát văn bản |
| "Translate this to [language]: {text}" | Dịch |
| "Rewrite this as an executive summary: {text}" | Báo cáo lên trên |
| "What's missing from this document? {text}" | Review gap |
| "Write a response email based on: {text}" | Trả lời từ note |
| "Create meeting agenda from: {text}" | Chuẩn bị họp |
| "Give me 3 counter-arguments to: {text}" | Phản biện |

Người dùng có thể thêm custom template.

### 2.3 Tier 1: Free API + Full AI Integration

#### 2.3.1 Provider Architecture (Chỉ Free Tier Providers)

```
┌─ Rust Backend ───────────────────────────────────┐
│  ai_providers.rs                                  │
│                                                   │
│  trait AiProvider {                               │
│    async fn chat(messages, system_prompt) -> Stream│
│    async fn list_models() -> Vec<ModelInfo>       │
│  }                                                │
│                                                   │
│  impl GoogleAiStudioProvider {                    │
│    - POST generativelanguage.googleapis.com       │
│    - Auth: x-goog-api-key header                  │
│    - Models: gemini-2.5-flash, gemini-2.5-pro     │
│    - Free tier: 1,500 req/ngày (Flash)           │
│    - Stream: SSE (Server-Sent Events)             │
│  }                                                │
│                                                   │
│  impl GroqProvider {                              │
│    - POST https://api.groq.com/openai/v1/...     │
│    - Auth: Bearer token                           │
│    - Models: llama-4-maverick, mixtral, gemma... │
│    - Free tier: ~30 req/min                       │
│    - Stream: SSE (OpenAI-compatible)              │
│  }                                                │
│                                                   │
│  ai_chat(provider, model, messages) → Stream      │
│    - Emits events qua Tauri event system          │
│    - Frontend listens: ai-chunk, ai-done, ai-error│
└───────────────────────────────────────────────────┘
```

**Tại sao chỉ 2 provider này?**
- Cả hai đều có **free tier rất hào phóng** — đủ cho người dùng cá nhân
- **Google AI Studio**: Key dễ lấy nhất (Google account → 1 click)
- **Groq**: API OpenAI-compatible, code dễ nhất, tốc độ inference nhanh nhất
- Không cần OpenAI/Anthropic trả phí — gây rào cản cho BA/CEO

#### 2.3.2 AI Setup Wizard (First-Run Experience)

```
Lần đầu mở AI tab khi chưa có provider
    │
    ▼
┌─────────────────────────────────────────────┐
│  🤖 Welcome to AI Assistant                 │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 🆓 Get a FREE API key (2 minutes)     │  │
│  │ We'll guide you step by step          │  │
│  │ ✨ Recommended for full AI features   │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 🌐 Use ChatGPT/Claude in browser      │  │
│  │ Quick copy-paste, no setup needed     │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 🔑 I already have an API key          │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Nhánh "Get FREE API key" → Wizard 3 bước:**

1. **Step 1**: "Open Google AI Studio → Get API Key" (kèm link + screenshot mini)
2. **Step 2**: "Paste your key below" → Test Connection
3. **Step 3**: "Choose model" (Gemini 2.5 Flash recommended) → Done

#### 2.3.3 AI Chat Panel

Panel chat trong sidebar, context-aware:

```
┌─ AI Assistant ──────────────────────────┐
│  Context: requirements/q3-scope.md      │
│  [Model: Gemini 2.5 Flash ▼]            │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ 👤 You                              ││
│  │ Summarize this document in 3 bullet ││
│  │ points                              ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ 🤖 AI                               ││
│  │ Here's a summary:                   ││
│  │ • Budget allocated: $500K for Q3    ││
│  │ • Timeline: 6-month delivery        ││
│  │ • Key stakeholders: Marketing, Eng  ││
│  │                                     ││
│  │ [Insert in doc] [Copy]              ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ Ask about this document...          ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

**Context sources (tự động gửi kèm prompt):**
- Nội dung file đang active (toàn bộ hoặc N ký tự đầu nếu dài)
- Backlinks: danh sách file link đến file hiện tại (từ v1.8.0)
- Frontmatter: metadata của file (tags, date...)
- Graph neighbors: các file liên quan 1-hop (từ v1.8.0)
- Toàn bộ workspace (opt-in: nút "Include all workspace files")

Panel chat trong sidebar, context-aware:

```
┌─ AI Assistant ──────────────────────────┐
│  Context: requirements/q3-scope.md      │
│  [Model: GPT-4o ▼]                      │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ 👤 You                              ││
│  │ Summarize this document in 3 bullet ││
│  │ points                              ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ 🤖 AI                               ││
│  │ Here's a summary:                   ││
│  │ • Budget allocated: $500K for Q3    ││
│  │ • Timeline: 6-month delivery        ││
│  │ • Key stakeholders: Marketing, Eng  ││
│  │                                     ││
│  │ [Insert in doc] [Copy]              ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ Ask about this document...          ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

**Context sources (tự động gửi kèm prompt):**
- Nội dung file đang active (toàn bộ hoặc N ký tự đầu nếu dài)
- Backlinks: danh sách file link đến file hiện tại (từ v1.8.0)
- Frontmatter: metadata của file (tags, date...)
- Graph neighbors: các file liên quan 1-hop (từ v1.8.0)
- Toàn bộ workspace (opt-in: nút "Include all workspace files")

#### 2.3.4 Inline AI Actions (Editor Context Menu) — Tier 1 only

Select text trong editor → right-click → AI actions:

| Action | Mô tả |
|--------|-------|
| ✨ Improve Writing | Cải thiện văn phong, grammar, clarity |
| 📝 Summarize | Tóm tắt đoạn đã chọn |
| 🔄 Rewrite as... | Viết lại dưới dạng: bullet points / prose / email / formal report |
| 🌐 Translate to... | Dịch sang ngôn ngữ khác |
| 📏 Expand | Mở rộng ý ngắn thành đoạn đầy đủ |
| 📐 Shorten | Rút gọn đoạn dài |
| 🔍 Explain | Giải thích khái niệm trong đoạn đã chọn |
| ✅ Action Items | Trích xuất action items từ meeting notes |

Kết quả: stream vào AI chat panel, người dùng chọn Insert hoặc Copy.

#### 2.3.5 AI Toolbar Button

Thêm nút "AI" trong SourceEditor toolbar. Hai chế độ:

- **Khi chưa có API key (Tier 0):** Hiển thị "Send to Web AI" flow
- **Khi đã có API key (Tier 1):** Dropdown với các action nhanh:
  - "Summarize document"
  - "Find action items"
  - "Improve grammar"
  - "Generate outline for new section"
  - "Continue writing..." (AI viết tiếp từ vị trí cursor)

#### 2.3.6 Quick AI (Global Shortcut) — Tier 1 only

`Cmd+Shift+K` → mở mini prompt floating:

```
┌──────────────────────────────────────┐
│ 🤖 Quick AI                          │
│ ┌──────────────────────────────────┐ │
│ │ Summarize this doc               │ │
│ └──────────────────────────────────┘ │
│ Context: current file + 3 backlinks  │
│                         [Esc] [↵ Ask]│
└──────────────────────────────────────┘
```

Kết quả trả về trong AI Chat Panel.

#### 2.3.7 AI Graph Insights (Tier 1 + v1.8.0 Graph View)

Trong Graph Panel, thêm nút "AI Insights":

- "Find orphan documents" (file không có link)
- "Suggest connections" (AI gợi ý file nào nên link với nhau)
- "Cluster topics" (AI phân nhóm tài liệu theo chủ đề)
- "Knowledge gaps" (chủ đề nào chưa được cover?)

### 2.4 Stories — Pillar B

#### S-AI0 — Tier 0: "Send to Web AI" — Prompt Template + Browser Bridge
* **Goal:** Cho phép người dùng gửi nội dung file/selection đến ChatGPT/Claude web và paste kết quả về — không cần API key.
* **Scope:**
  - Tạo `src/components/SendToWebAiDialog.vue`:
    - Hiển thị prompt template library (9 templates built-in + custom)
    - Dropdown chọn template, preview nội dung sẽ gửi
    - Nút "Open ChatGPT" / "Open Claude" / "Open Gemini" → copy nội dung vào clipboard + mở browser qua `tauri-plugin-opener`
  - Tạo `src/components/PasteAiResponsePanel.vue`:
    - Textarea để paste kết quả từ web AI
    - Nút "Insert at Cursor" / "Replace Selection"
    - Lưu lịch sử 5 lần paste gần nhất
  - `SourceEditor.vue` toolbar: Nút "Ask AI" (icon: `lucide:sparkles`) mở `SendToWebAiDialog`
  - Prompt templates lưu trong `mdview-settings.json` (có thể custom thêm)
  - i18n keys: `ai.webSendTitle`, `ai.webSendOpenChatgpt`, `ai.webSendOpenClaude`, `ai.webSendOpenGemini`, `ai.webSendCopied`, `ai.webPasteTitle`, `ai.webPasteInsert`, `ai.webPasteReplace`, `ai.templateSummarize`, `ai.templateActions`, `ai.templateImprove`, `ai.templateTranslate`, `ai.templateExecSummary`, `ai.templateReview`, `ai.templateEmail`, `ai.templateAgenda`, `ai.templateCounter`
* **Complexity:** Thấp (Frontend only, dùng opener plugin đã có)
* **Priority:** 🔴 Phải có — fallback cho mọi user

#### S-AI1 — Rust: AI Provider Infrastructure (Google AI Studio + Groq)
* **Goal:** Xây dựng abstraction layer cho 2 provider miễn phí.
* **Scope:**
  - Thêm `reqwest = { version = "0.12", features = ["json", "stream"] }` vào `Cargo.toml`
  - Thêm `tokio = { version = "1", features = ["full"] }` (đã có implicit qua Tauri)
  - Tạo `src-tauri/src/ai/mod.rs` + `src-tauri/src/ai/google_ai_studio.rs` + `src-tauri/src/ai/groq.rs`:
    - `AiProvider` trait: `async fn chat_stream(&self, model, messages, system_prompt) -> Result<EventEmitter>`
    - `GoogleAiStudioProvider`: POST đến `generativelanguage.googleapis.com`, parse SSE stream, auth qua `x-goog-api-key`
    - `GroqProvider`: POST đến `api.groq.com/openai/v1/chat/completions`, parse SSE stream (OpenAI-compatible), auth qua Bearer token
    - Streaming qua Tauri event: emit `ai-chunk:{id}` events → frontend listen
  - Tauri command: `ai_chat(provider: String, model: String, messages: Vec<ChatMessage>) -> u32` — trả về stream ID
  - Tauri command: `ai_cancel(stream_id: u32)` — hủy stream đang chạy
  - Tauri command: `ai_list_models(provider: String) -> Vec<String>` — lấy danh sách model
  - Update `invoke_handler![]` và `default.json`.
* **Complexity:** Trung bình–Cao (Rust — async streaming + 2 API integrations, giảm từ 4 xuống 2)
* **Dependencies:** `reqwest` (~2MB), `tokio` (đã có)

#### S-AI2 — Store: `ai.ts`
* **Goal:** Pinia store quản lý AI state, chat history, context builder. Hỗ trợ cả Tier 0 và Tier 1.
* **Scope:**
  - Tạo `src/stores/ai.ts`:
    - State: `provider`, `model`, `apiKey`, `chatHistory: ChatMessage[]`, `isStreaming`, `currentStreamId`, `webAiHistory: WebAiEntry[]` (lịch sử paste từ Tier 0)
    - Computed: `hasProvider` (đã cấu hình API key chưa?), `isTier1Ready` (có thể dùng full AI)
    - Method `sendMessage(content)` — Tier 1: thêm user message, gọi `ai_chat`, listen events
    - Method `cancelStream()` — gọi `ai_cancel`
    - Method `buildContext(file, target)` — tạo context string từ file + backlinks + graph neighbors
    - Method `clearHistory()`
    - Method `setProvider(provider)` — cập nhật + persist
    - Method `addWebAiEntry(prompt, result)` — Tier 0: lưu lịch sử paste
    - Persist: `ai_provider`, `ai_model`, `ai_api_key` trong `mdview-settings.json`
    - Computed: `contextSummary` (file + N backlinks)
  - Event listener: `listen('ai-chunk:{id}', ...)` → append vào message cuối
* **Complexity:** Trung bình

#### S-AI3 — Component: `AiChatPanel.vue`
* **Goal:** Chat panel trong sidebar với streaming response.
* **Scope:**
  - Tạo `src/components/AiChatPanel.vue`:
    - Header: "AI Assistant" + context indicator (tên file đang active) + model selector
    - Chat area: scrollable, auto-scroll bottom khi streaming
    - User message bubble (phải, accent background)
    - AI message bubble (trái, muted background) — Markdown rendering (dùng markdown-it như PreviewPane)
    - Streaming indicator: cursor nhấp nháy khi AI đang trả lời
    - Input area: textarea auto-resize + nút Send + `Enter` to send, `Shift+Enter` newline
    - Empty state: "Ask me anything about your documents. I can see the current file and related notes."
    - Context toggle: checkbox "Include full workspace" (mặc định: current file + backlinks)
    - Action buttons trên mỗi AI response: [Insert at cursor] [Copy] [Replace selection]
  - i18n keys: `ai.title`, `ai.placeholder`, `ai.empty`, `ai.contextFile`, `ai.contextWorkspace`, `ai.streaming`, `ai.insert`, `ai.copy`
* **Complexity:** Trung bình–Cao (chat UI + markdown render + streaming)

#### S-AI4 — Sidebar Integration: AI Tab + Activity Row
* **Goal:** Thêm AI chat vào sidebar activity row.
* **Scope:**
  - Thêm sidebar tab "AI" (icon: `lucide:sparkles`) vào activity row.
  - `Sidebar.vue` render `<AiChatPanel>` khi `sidebarView === "ai"`.
  - Badge trên icon khi AI đang streaming.
  - i18n key: `explorer.ai`
* **Complexity:** Thấp

#### S-AI5 — Inline AI Actions: Editor Context Menu
* **Goal:** Right-click selected text → AI actions menu.
* **Scope:**
  - `SourceEditor.vue`: Thêm context menu handler cho text selection.
  - Menu items động dựa trên selection (có text được chọn):
    - "Improve Writing"
    - "Summarize Selection"
    - "Rewrite as Bullets"
    - "Rewrite as Prose"
    - "Translate..."
    - "Expand"
    - "Shorten"
    - "Explain"
    - "Extract Action Items"
  - Submenu "Translate to...": English, Vietnamese, Japanese, Chinese, French, German...
  - Khi chọn action → gọi `ai.sendMessage()` với system prompt tương ứng + selected text
  - Kết quả stream vào AI chat panel (không tự động insert — người dùng chọn Insert)
  - Hoặc: Inline replace với loading indicator trong editor (advanced)
  - i18n keys: `ai.inlineImprove`, `ai.inlineSummarize`, `ai.inlineRewriteBullets`, `ai.inlineRewriteProse`, `ai.inlineTranslate`, `ai.inlineExpand`, `ai.inlineShorten`, `ai.inlineExplain`, `ai.inlineActions`
* **Complexity:** Trung bình

#### S-AI6 — SourceEditor: AI Toolbar Button + Quick AI
* **Goal:** Thêm nút AI trong toolbar và global shortcut cho Quick AI.
* **Scope:**
  - `SourceEditor.vue` toolbar: Thêm nút "AI" (icon: `lucide:sparkles`) với dropdown:
    - "Summarize Document"
    - "Find Action Items"
    - "Improve Grammar & Clarity"
    - "Generate Outline"
    - "Continue Writing"
  - `App.vue`: Thêm keyboard shortcut `Cmd+Shift+K` → mở `QuickAiPrompt` floating dialog
  - Tạo `src/components/QuickAiPrompt.vue`:
    - Floating input với backdrop blur
    - Auto-focus input
    - Context summary hiển thị (current file + N backlinks)
    - Enter → gửi → kết quả vào AI Chat Panel
    - Esc → đóng
  - i18n keys: `ai.toolbarSummarize`, `ai.toolbarActions`, `ai.toolbarImprove`, `ai.toolbarOutline`, `ai.toolbarContinue`, `ai.quickTitle`
* **Complexity:** Thấp

#### S-AI7 — Settings: AI Provider Configuration + Setup Wizard
* **Goal:** Cấu hình AI provider, model, API key trong Settings. Kèm wizard hướng dẫn lấy key miễn phí.
* **Scope:**
  - `SettingsModal.vue`: Thêm section "AI Assistant":
    - Provider dropdown: Google AI Studio / Groq
    - API Key input (type=password)
    - Link "How to get a free API key" → mở browser đến aistudio.google.com hoặc console.groq.com
    - Setup Wizard button: mở step-by-step guide (3 bước có screenshot)
    - Model dropdown (fetch từ provider API sau khi có key)
    - "Test Connection" button → gọi `ai_list_models` hoặc quick test chat
    - Status indicator: "✅ Connected" / "⚠️ Not configured" / "❌ Invalid key"
    - System prompt textarea (tùy chỉnh, có default tốt)
  - Setup Wizard flow (first-run hoặc khi bấm "Setup Guide"):
    - Step 1: Chọn provider + link mở trang lấy key + ảnh minh họa
    - Step 2: Paste key + Test Connection
    - Step 3: Chọn model + done
  - Persist tất cả settings vào `mdview-settings.json`.
  - i18n keys: `ai.settingsTitle`, `ai.settingsProvider`, `ai.settingsApiKey`, `ai.settingsModel`, `ai.settingsTestConnection`, `ai.settingsTestSuccess`, `ai.settingsTestFailed`, `ai.settingsGetApiKey`, `ai.settingsWizardTitle`, `ai.settingsWizardStep1`, `ai.settingsWizardStep2`, `ai.settingsWizardStep3`, `ai.settingsConnected`, `ai.settingsNotConfigured`
* **Complexity:** Trung bình

#### S-AI8 — AI Graph Insights (Optional, phụ thuộc v1.8.0)
* **Goal:** AI phân tích workspace graph để gợi ý cấu trúc tri thức.
* **Scope:**
  - `GraphPanel.vue`: Thêm nút "AI Insights" (chỉ hiện khi AI được cấu hình)
  - Click → gửi prompt với context là toàn bộ graph structure (node names + edges, không gửi nội dung)
  - AI trả về:
    - "Orphan documents" — file không có link, gợi ý nên link đến đâu
    - "Topic clusters" — nhóm file theo chủ đề
    - "Suggested connections" — file A và B nên link với nhau vì...
    - "Knowledge gaps" — chủ đề quan trọng chưa có tài liệu
  - Kết quả hiển thị trong panel dưới graph: danh sách suggestions, click để xem chi tiết
  - i18n keys: `ai.graphInsights`, `ai.graphOrphans`, `ai.graphClusters`, `ai.graphConnections`, `ai.graphGaps`
* **Complexity:** Trung bình | **Priority:** Nice-to-have (phụ thuộc v1.8.0 ship xong)

---

## 3. PILLAR C: Smart Workspace Features

### 3.1 Smart File Creation (AI-Assisted)

Khi tạo file mới, thêm option "Generate with AI":

```
┌──────────────────────────────────────┐
│  New File                            │
│                                      │
│  Name: q3-retrospective.md           │
│                                      │
│  Template: ○ Empty  ● Meeting Notes  │
│                                      │
│  ☐ Generate content with AI          │
│    Describe what you need:           │
│    ┌──────────────────────────────┐  │
│    │ Retrospective of Q3 marketing│  │
│    │ campaign. Include sections:  │  │
│    │ Goals, Results, Lessons,     │  │
│    │ Next Steps                   │  │
│    └──────────────────────────────┘  │
│                                      │
│                [Cancel]  [Create]    │
└──────────────────────────────────────┘
```

### 3.2 Smart Search (AI-Enhanced)

Trong SearchPanel, thêm mode "Ask AI" — thay vì keyword search, hỏi bằng ngôn ngữ tự nhiên:

> "Which documents discuss the Q3 budget?"
> "Find all meeting notes where John was mentioned"

AI trả về danh sách file kèm giải thích ngắn vì sao file đó liên quan.

### 3.3 Stories — Pillar C

#### S-SW1 — AI-Assisted File Creation
* **Goal:** Cho phép AI generate nội dung file mới dựa trên mô tả.
* **Scope:**
  - Mở rộng `TemplateChooser.vue` hoặc `ctxNewFile()` flow:
    - Thêm checkbox "Generate with AI" (chỉ hiện khi AI configured)
    - Textarea mô tả nội dung cần generate
    - Khi Create → gọi AI generate → điền vào file mới
  - i18n keys: `ai.generateFile`, `ai.generateDesc`
* **Complexity:** Thấp

#### S-SW2 — AI-Enhanced Search
* **Goal:** Natural language search trong workspace.
* **Scope:**
  - `SearchPanel.vue`: Thêm toggle "AI Search" / "Text Search"
  - AI mode: input tự nhiên → gửi prompt với context workspace files
  - AI trả về: danh sách file liên quan + lý do ngắn
  - Kết quả hiển thị giống text search nhưng có thêm "Why this file" expandable
  - Fallback: nếu AI không configured → ẩn toggle, chỉ text search
  - i18n keys: `search.aiMode`, `search.aiModeDesc`, `search.aiWhyFile`
* **Complexity:** Trung bình

---

## 4. DEPENDENCY MAP

```
                    v1.7.0                   v1.8.0
                       │                        │
                       ▼                        ▼
              ┌─────────────────────────────────┐
              │         v2.0.0                  │
              │                                 │
              │  Pillar A: Git (độc lập)        │
              │  ┌─ S-GT1 (git2-rs core)        │
              │  ├─ S-GT2 (init/clone/conflict)  │
              │  ├─ S-GT3 (git.ts store)         │
              │  ├─ S-GT4 (GitStatusBar)         │
              │  ├─ S-GT5 (SaveVersionDialog)    │
              │  ├─ S-GT6 (VersionHistoryPanel)  │
              │  ├─ S-GT7 (DiffView+Conflict)    │
              │  └─ S-GT8 (Tree badges+connect)  │
              │                                 │
              │  Pillar B: AI (độc lập)          │
              │  ┌─ S-AI0 (Tier 0: Send to Web AI)│
              │  ├─ S-AI1 (Rust providers)        │
              │  ├─ S-AI2 (ai.ts store)           │
              │  ├─ S-AI7 (Settings + Wizard)     │
              │  ├─ S-AI3 (AiChatPanel)           │
              │  ├─ S-AI4 (Sidebar tab)           │
              │  ├─ S-AI5 (Inline AI actions)     │
              │  ├─ S-AI6 (Toolbar + Quick AI)    │
              │  └─ S-AI8 (Graph insights) ◄────── dep: v1.8.0
              │                                 │
              │  Pillar C: Smart Workspace       │
              │  ┌─ S-SW1 (AI file creation)     │
              │  └─ S-SW2 (AI search)            │
              └─────────────────────────────────┘
```

**Pillar A (Git) và Pillar B (AI) hoàn toàn độc lập — có thể phát triển song song.**

---

## 5. COMPLEXITY & PRIORITY MATRIX

| Story | Feature | Complexity | Rust? | Priority |
|-------|---------|------------|-------|----------|
| **Pillar A — Git Made Simple** |
| S-GT1 | Rust: git2-rs core commands | 🔴 Cao | ✅ | 🔴 Phải có |
| S-GT2 | Rust: init/clone/conflict | 🟡 TB–Cao | ✅ | 🟠 Cao |
| S-GT3 | Store: git.ts | 🟡 TB | ❌ | 🔴 Phải có |
| S-GT4 | GitStatusBar | 🟢 Thấp | ❌ | 🔴 Phải có |
| S-GT5 | SaveVersionDialog | 🟢 Thấp | ❌ | 🔴 Phải có |
| S-GT6 | VersionHistoryPanel | 🟡 TB | ❌ | 🟠 Cao |
| S-GT7 | DiffView + ConflictResolver | 🔴 Cao | ❌ | 🟡 TB |
| S-GT8 | Tree badges + Connect flow | 🟡 TB | ❌ | 🟠 Cao |
| **Pillar B — AI Assistant** |
| S-AI0 | Tier 0: Send to Web AI | 🟢 Thấp | ❌ | 🔴 Phải có |
| S-AI1 | Rust: AI provider infra (Google + Groq) | 🟡 TB–Cao | ✅ | 🔴 Phải có |
| S-AI2 | Store: ai.ts | 🟡 TB | ❌ | 🔴 Phải có |
| S-AI7 | Settings AI config + Setup Wizard | 🟡 TB | ❌ | 🔴 Phải có |
| S-AI3 | AiChatPanel | 🟡 TB–Cao | ❌ | 🔴 Phải có |
| S-AI4 | Sidebar AI tab | 🟢 Thấp | ❌ | 🔴 Phải có |
| S-AI5 | Inline AI actions (editor) | 🟡 TB | ❌ | 🟠 Cao |
| S-AI6 | Toolbar + Quick AI | 🟢 Thấp | ❌ | 🟡 TB |
| S-AI8 | AI Graph insights | 🟡 TB | ❌ | 🟢 Thấp (dep v1.8.0) |
| **Pillar C — Smart Workspace** |
| S-SW1 | AI-assisted file creation | 🟢 Thấp | ❌ | 🟡 TB |
| S-SW2 | AI-enhanced search | 🟡 TB | ❌ | 🟡 TB |

---

## 6. NEW FILES EXPECTED

```
# Git
src-tauri/src/git.rs                         (S-GT1, S-GT2) — git2-rs wrapper module
src/stores/git.ts                            (S-GT3) — Git state store
src/components/GitStatusBar.vue              (S-GT4) — Bottom status bar
src/components/SaveVersionDialog.vue         (S-GT5) — Save version dialog
src/components/VersionHistoryPanel.vue       (S-GT6) — History timeline
src/components/DiffViewDialog.vue            (S-GT7) — Visual diff viewer
src/components/ConflictResolver.vue          (S-GT7) — Conflict resolution UI

# AI
src-tauri/src/ai/mod.rs                      (S-AI1) — AI provider abstraction
src-tauri/src/ai/google_ai_studio.rs         (S-AI1) — Google AI Studio provider
src-tauri/src/ai/groq.rs                     (S-AI1) — Groq provider
src/stores/ai.ts                             (S-AI2) — AI state + chat history
src/components/AiChatPanel.vue               (S-AI3) — Chat UI (Tier 1)
src/components/SendToWebAiDialog.vue         (S-AI0) — Tier 0: prompt template + browser bridge
src/components/PasteAiResponsePanel.vue      (S-AI0) — Tier 0: paste result back
src/components/QuickAiPrompt.vue             (S-AI6) — Floating quick prompt (Tier 1)

# Smart Workspace
(modified existing files — no new components)
```

## 7. MODIFIED FILES EXPECTED

```
# Cargo
src-tauri/Cargo.toml                         (S-GT1, S-AI1) — git2, reqwest deps
src-tauri/src/lib.rs                         (S-GT1, S-GT2, S-AI1) — new commands
src-tauri/capabilities/default.json          (updates)

# Git
src/components/App.vue                       (S-GT4) — GitStatusBar integration
src/components/FileTreeNode.vue              (S-GT8) — Git badges
src/components/ExplorerPanel.vue             (S-GT8) — Connect flow
src/components/Sidebar.vue                   (S-GT6) — VersionHistory tab
src/stores/ui.ts                             (S-GT6) — sidebarView states

# AI
src/components/Sidebar.vue                   (S-AI4) — AI chat tab
src/components/ExplorerPanel.vue             (S-AI4, S-SW1) — AI file creation
src/components/SourceEditor.vue              (S-AI0, S-AI5, S-AI6) — Tier 0 send + inline AI + toolbar
src/components/App.vue                       (S-AI0, S-AI6) — Quick AI shortcut + Tier 0 paste panel
src/components/SearchPanel.vue               (S-SW2) — AI search mode
src/components/SettingsModal.vue             (S-AI7) — AI provider config + Setup Wizard
src/components/GraphPanel.vue                (S-AI8) — AI insights button
src/stores/ui.ts                             (S-AI4) — sidebarView "ai"

# Package
package.json                                 (no new frontend deps expected)

# i18n
src/i18n/index.ts                            (~90 new keys)
```

## 8. NEW DEPENDENCIES

| Dependency | Side | Size | Purpose |
|-----------|------|------|---------|
| `git2` | Rust | ~2MB compiled | Git operations via libgit2 |
| `reqwest` | Rust | ~2MB compiled | HTTP client for AI API calls |
| `tokio` | Rust | already implicit | Async runtime for streaming |
| `diff` (npm) | Frontend | ~15KB | Text diff rendering |
| *(no other new JS deps)* | | | AI streaming handled via Tauri events |

**Total Rust binary increase:** ~4MB (chấp nhận được)

---

## 9. NEW I18N KEYS

```
# Git status bar
git.upToDate
git.unsavedChanges
git.ahead
git.behind
git.conflicts
git.noRepo
git.connect
git.saving
git.sharing
git.gettingUpdates

# Save version
git.saveTitle
git.savePlaceholder
git.saveFilesIncluded
git.saveAndShare
git.saveSuccess

# Version history
git.historyTitle
git.historyToday
git.historyYesterday
git.viewChanges
git.noHistory

# Diff & Conflict
git.diffTitle
git.diffAdded
git.diffRemoved
git.conflictTitle
git.conflictCount
git.conflictKeepYours
git.conflictKeepTheirs
git.conflictKeepBoth
git.conflictNext
git.conflictResolveAll
git.conflictResolved

# Connect
git.connectTitle
git.connectUrl
git.connectUrlDesc
git.connectCreate
git.connectClone
git.connectExisting
git.connectSuccess

# AI — Tier 0 (Send to Web AI)
ai.webSendTitle
ai.webSendOpenChatgpt
ai.webSendOpenClaude
ai.webSendOpenGemini
ai.webSendCopied
ai.webPasteTitle
ai.webPasteInsert
ai.webPasteReplace

# AI — Prompt Templates (dùng chung Tier 0 + Tier 1)
ai.templateSummarize
ai.templateActions
ai.templateImprove
ai.templateTranslate
ai.templateExecSummary
ai.templateReview
ai.templateEmail
ai.templateAgenda
ai.templateCounter

# AI — Tier 1 Chat
ai.title
ai.placeholder
ai.empty
ai.setupWizard
ai.setupFree
ai.setupWeb
ai.setupHaveKey
ai.streaming
ai.insert
ai.copy
ai.replaceSelection
ai.contextFile
ai.contextWorkspace
ai.contextBacklinks
ai.contextNone
ai.errorNoProvider
ai.errorApiKey
ai.errorStream

# AI Inline Actions
ai.inlineImprove
ai.inlineSummarize
ai.inlineRewriteBullets
ai.inlineRewriteProse
ai.inlineTranslate
ai.inlineExpand
ai.inlineShorten
ai.inlineExplain
ai.inlineActions
ai.inlineTranslateTo

# AI Toolbar
ai.toolbarAsk
ai.toolbarSummarize
ai.toolbarActions
ai.toolbarImprove
ai.toolbarOutline
ai.toolbarContinue

# Quick AI
ai.quickTitle
ai.quickPlaceholder
ai.quickContext

# AI Settings + Wizard
ai.settingsTitle
ai.settingsProvider
ai.settingsApiKey
ai.settingsApiKeyDesc
ai.settingsModel
ai.settingsWizardTitle
ai.settingsWizardStep1
ai.settingsWizardStep2
ai.settingsWizardStep3
ai.settingsSystemPrompt
ai.settingsTestConnection
ai.settingsTestSuccess
ai.settingsTestFailed
ai.settingsGetApiKey
ai.settingsConnected
ai.settingsNotConfigured

# AI File Creation
ai.generateFile
ai.generateDesc
ai.generatingFile

# AI Search
search.aiMode
search.aiModeDesc
search.aiWhyFile

# AI Graph
ai.graphInsights
ai.graphOrphans
ai.graphClusters
ai.graphConnections
ai.graphGaps

# Explorer
explorer.versionHistory
explorer.ai
```

---

## 10. PROPOSED IMPLEMENTATION ORDER (6 tuần)

**Tuần 1–2 — Pillar A Foundation:**
1. S-GT1 — Rust: git2-rs core (status, save, share, get updates, history, diff)
2. S-GT2 — Rust: init, clone, conflict resolution
3. S-GT3 — Store: git.ts
4. S-GT4 — GitStatusBar (visible ngay, tạo động lực)
5. S-GT5 — SaveVersionDialog

**Tuần 2–3 — Pillar B Foundation:**
6. S-AI0 — Tier 0: Send to Web AI (có ngay, zero setup, fallback cho mọi user)
7. S-AI1 — Rust: AI providers (Google AI Studio + Groq)
8. S-AI7 — Settings: AI config + Setup Wizard
9. S-AI2 — Store: ai.ts
10. S-AI3 — AiChatPanel (core Tier 1 experience)
11. S-AI4 — Sidebar AI tab

**Tuần 3–4 — Git Polish + AI Actions:**
12. S-GT6 — VersionHistoryPanel
13. S-GT8 — File tree badges + Connect flow
14. S-AI5 — Inline AI actions (editor context menu)
15. S-AI6 — Toolbar + Quick AI shortcut

**Tuần 4–5 — Advanced Git + AI:**
16. S-GT7 — DiffView + ConflictResolver
17. S-AI8 — AI Graph insights (nếu v1.8.0 đã ship)
18. S-SW1 — AI-assisted file creation
19. S-SW2 — AI-enhanced search

**Tuần 5–6 — Polish, Testing, Bug Fix:**
- End-to-end testing Git workflows
- AI streaming edge cases (network failure, rate limit, token limit)
- Performance: large repo status polling, AI context window management
- UX polish: empty states, error states, loading skeletons
- Tier 0 ↔ Tier 1 transition: test flow khi user upgrade từ Web AI lên API key

---

## 11. RISK ASSESSMENT

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|------------|
| `git2-rs` API phức tạp, edge case nhiều | 🟡 TB | 🔴 Cao | Spike 3 ngày prototype git workflow trước Sprint |
| AI API free tier bị Google/Groq thay đổi giới hạn | 🟢 Thấp | 🟡 TB | Theo dõi thông báo từ provider, có fallback Tier 0 luôn hoạt động |
| Stream parsing khác nhau giữa Google và Groq | 🟡 TB | 🟡 TB | Abstract SSE parser, test từng provider riêng |
| Git merge conflict UX không đủ tốt cho non-tech | 🟡 TB | 🔴 Cao | User testing với BA thật, iterate conflict UI |
| AI context window overflow với workspace lớn | 🟢 Thấp | 🟡 TB | Auto-truncate, hiển thị token count, ưu tiên file liên quan |
| `reqwest` + `tokio` conflict với Tauri runtime | 🟢 Thấp | 🔴 Cao | Test early, Tauri 2 đã dùng tokio — khả năng tương thích cao |
| API key security (lưu trong settings file) | 🟢 Thấp | 🟡 TB | Keychain integration ở phiên bản sau; ban đầu lưu trong Tauri store (encrypted) |
| Người dùng TIER 0 không biết copy-paste giữa app và browser | 🟢 Thấp | 🟢 Thấp | Auto-copy + tự động mở browser; hướng dẫn ngắn trong UI |

---

## 12. SUCCESS METRICS

| Metric | Target |
|--------|--------|
| "Save & Share" flow hoàn thành | <3 clicks, <30s cho người mới |
| Git status detection sau file save | <100ms |
| AI Tier 0: Send to Web AI hoàn thành | <5 giây từ click đến mở browser |
| AI Tier 1: First response (TTFT) | <2s với streaming |
| AI context window sử dụng hiệu quả | Hiển thị token count, cảnh báo khi >80% |
| AI Setup Wizard hoàn thành | <2 phút từ đầu đến "Connected" |
| Git diff render với file 1000 dòng | <500ms |
| Conflict resolution UX | Người dùng non-tech giải quyết được conflict trong <2 phút |
| Binary size increase | <5MB (git2 + reqwest) |
| Cold start time increase | <200ms (git status check on load) |
| New Rust commands | 13 (8 git + 4 AI + 1 search) |
| New Vue components | 11 |
| New Pinia stores | 2 (`git.ts`, `ai.ts`) |
| New i18n keys | ~90 |

---

## 13. OPEN QUESTIONS

1. **GitHub authentication:** Người dùng BA/CEO không có SSH key. Dùng HTTPS + PAT (Personal Access Token) hay tích hợp OAuth? → Đề xuất: PAT với hướng dẫn tạo trong app (link đến GitHub token page).

2. **Branch strategy:** Ẩn hoàn toàn branch concept hay cho phép advanced users mở khóa? → Đề xuất: Mặc định ẩn branch, "main" branch only. Advanced toggle trong Settings cho người biết git.

3. **AI provider default:** Chỉ Google AI Studio + Groq (cả hai free). Có nên thêm OpenAI/Anthropic cho user trả phí không? → Đề xuất: Không trong v2.0.0. Giữ đơn giản — free only. Thêm paid provider ở v2.1+ nếu có demand.

4. **Tier 0 → Tier 1 upgrade path:** Khi nào và làm sao prompt user nâng cấp từ Web AI lên API key? → Đề xuất: Hiển thị banner nhỏ trong Tier 0 panel: "Want AI to see your documents automatically? Set up a free API key in 2 minutes →". Không popup, không nag.

5. **Multi-file AI context:** Gửi bao nhiêu file context cho AI? Toàn bộ workspace có thể quá lớn. → Đề xuất: Mặc định gửi file đang active + backlinks + 1-hop graph neighbors. Toggle "Include all workspace files" cho advanced use.

6. **Git large file warning:** Cảnh báo khi commit file >1MB? → Đề xuất: Warning dialog "This file is large (X MB). Consider using Git LFS for large files." với nút "Save anyway".

7. **Offline mode:** Git và AI cần network. UX khi offline? → Đề xuất: Git: vẫn hoạt động local (commit), disable Share/Get Updates. AI: Tier 0 vẫn hoạt động (chỉ cần browser), Tier 1 hiển thị "AI requires internet connection".
