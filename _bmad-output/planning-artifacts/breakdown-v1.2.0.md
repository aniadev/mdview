---
title: "mdview v1.2.0 — Feature Breakdown"
version: 1.2.0
created: 2026-05-18
status: planning
---

# v1.2.0 Feature Breakdown

Hai feature: **Multi Terminal Tabs** (FR-32, FR-33) và **In-App Updater UX** (FR-34, FR-35).

---

## 1. Multi Terminal Tabs (FR-32, FR-33)

### 1.1 Phân tích

Backend `pty_spawn` đã trả về `id: u32` và track sessions trong `PtyStore`. Không cần thay đổi Rust — PTY backend đã multi-session. Toàn bộ work là **frontend**.

### 1.2 Stories

#### S1 — Terminal Tab Bar UI
**Goal:** Render tab bar phía trên xterm.js canvas trong `TerminalPanel.vue`.

**Scope:**
- Component `TerminalTabBar.vue`: render danh sách tabs + "+" button
- Props: `tabs: TerminalTab[]`, active tab id
- Events: `@create`, `@switch(id)`, `@close(id)`
- Style: consistent với editor Tab bar (dark/light theme)

**Acceptance:**
- "+" click → tab mới xuất hiện, active
- Click tab → switch (không kill session)
- X click → confirm nếu process đang chạy → close

**Complexity:** Thấp — pure UI

---

#### S2 — Terminal Store: Multi-session State
**Goal:** `ui` store hoặc dedicated `terminal` store quản lý nhiều PTY sessions.

**Scope:**
- `terminals: Map<id, { label: string, customLabel?: string }>` trong store
- `activeTerminalId: number | null`
- Actions: `createTerminal()`, `closeTerminal(id)`, `switchTerminal(id)`, `renameTerminal(id, name)`
- `createTerminal()` gọi `invoke('pty_spawn')` → nhận id → thêm vào map
- `closeTerminal(id)` gọi `invoke('pty_kill', { id })` → remove từ map
- `xterm-store`: map `id → Terminal instance` (xterm.js object) để buffer survive switch

**Dependency:** S1 (tab bar cần store actions)

**Complexity:** Trung bình — cần giữ xterm.js instance alive khi switch

**Key decision:** xterm.js `Terminal` instance không destroy khi switch tab — attach/detach từ DOM thay vì recreate. Dùng `terminal.element` detach/attach hoặc `display: none`.

---

#### S3 — Terminal Tab Rename (FR-33)
**Goal:** Double-click tab label → inline input đổi tên.

**Scope:**
- Reuse pattern `InlineFilenameInput.vue` (đã có từ v1.1 file management)
- Double-click label trong `TerminalTabBar` → set `editingTabId`
- Confirm (Enter) → `renameTerminal(id, newName)` trong store
- Truncate display tại 30 chars (CSS + store validation)

**Dependency:** S1, S2

**Complexity:** Thấp — pattern đã có

---

#### S4 — Terminal Tab Persistence (session-scope)
**Goal:** Buffer và process survive tab switch; không persist qua app restart.

**Scope:**
- `pty-data` event handler check `activeTerminalId` trước khi write tới xterm — vẫn buffer tất cả sessions
- App close → iterate `terminals` map → `invoke('pty_kill', id)` cho tất cả

**Dependency:** S2

**Complexity:** Thấp — cleanup logic đơn giản

---

### 1.3 Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| xterm.js instance leak khi close tab | Gọi `terminal.dispose()` sau `pty_kill` |
| `pty-data` event cho session không active overhead | Event vẫn buffer (không drop) — không render tới DOM nếu not active |
| Tab bar chiếm space → xterm.js nhỏ hơn | `pty_resize` phải tính lại rows/cols sau tab bar height |

---

### 1.4 Implementation Order

```
S2 (store) → S1 (tab bar UI) → S3 (rename) → S4 (cleanup)
```

---

## 2. In-App Updater UX (FR-34, FR-35)

### 2.1 Phân tích

`tauri-plugin-updater` đã config trong `tauri.conf.json` và dùng từ v1.0.1 (startup check). v1.2 bổ sung:
1. Manual trigger endpoint
2. Modal component với release notes + progress
3. Download + install flow

Rust side: minimal — `tauri-plugin-updater` expose `check()` và `update.download_and_install()`. Frontend gọi qua `invoke` hoặc plugin API trực tiếp.

### 2.2 Stories

#### S5 — "Check for Updates" Entry Point (FR-34)
**Goal:** User có thể trigger update check thủ công từ App Header.

**Scope:**
- Thêm button (hoặc dropdown menu item) "Check for Updates" trong `AppHeader.vue`
- Click → gọi update check function (shared với startup check)
- Loading state (spinner) trong button khi đang check
- "Up to date" toast (2s auto-dismiss) nếu không có update
- Nếu có update → mở `UpdateModal.vue`

**Acceptance:**
- Button visible và accessible từ mọi state của app
- Không block UI khi checking
- Toast dismiss tự động

**Complexity:** Thấp

---

#### S6 — Update Modal Component (FR-35)
**Goal:** Modal component hiển thị thông tin update.

**Scope:**
- `UpdateModal.vue` — teleport to `<body>` (overlay)
- Props: `version: string`, `releaseNotes: string`, `downloadUrl: string`
- Sections: version badge, release notes (markdown rendered bằng `markdown-it`, unsafe HTML stripped), action buttons
- States: `idle` → `downloading` → `ready-to-install` → `error`

**Layout:**
```
┌─────────────────────────────────┐
│  mdview v1.2.0 có sẵn           │
│  (current: v1.1.0)              │
├─────────────────────────────────┤
│  Release Notes                  │
│  ─────────────────────────────  │
│  [markdown rendered, scrollable]│
├─────────────────────────────────┤
│  [Để sau]        [Cập nhật ngay]│
└─────────────────────────────────┘
```

**Complexity:** Trung bình — release notes render + state machine

---

#### S7 — Download Progress (FR-35)
**Goal:** Progress bar trong modal khi đang download.

**Scope:**
- `tauri-plugin-updater` emit progress events (bytes downloaded / total)
- Listen trong `UpdateModal.vue`: `onProgress: (downloaded, total) => setProgress(downloaded/total)`
- Replace release notes area với progress bar khi `state === 'downloading'`
- "Cập nhật ngay" → "Đang tải... 45%" (disable button)
- Download done → button text đổi thành "Cài đặt & Khởi động lại"

**Error handling:**
- Network fail → `state = 'error'`, show error message + "Thử lại" button
- "Thử lại" reset về `idle` state (release notes lại visible)

**Dependency:** S6

**Complexity:** Trung bình

---

#### S8 — Startup Check Redirect (FR-34)
**Goal:** Unify startup check (v1.0.1) với modal mới.

**Scope:**
- Thay vì Tauri default dialog trên startup: nếu có update → mở `UpdateModal` component
- Startup check non-blocking (setTimeout hoặc sau `onMounted` idle)
- Prevent double-modal: nếu modal đang mở, skip startup trigger

**Dependency:** S6

**Complexity:** Thấp

---

### 2.3 Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| Release notes có HTML không safe | DOMPurify hoặc `markdown-it` với `html: false` |
| `tauri-plugin-updater` progress API khác nhau giữa versions | Kiểm tra plugin version trong `Cargo.toml` trước khi implement |
| User click "Cập nhật ngay" nhiều lần | Disable button ngay sau click đầu tiên |
| Không có internet → check fail | Catch error, không show modal, log silently |

---

### 2.4 Implementation Order

```
S5 (entry point + toast) → S6 (modal idle state) → S7 (download progress) → S8 (startup redirect)
```

---

## 3. Tổng hợp

### Dependency Graph

```
Terminal:   S2 → S1 → S3
                  └─→ S4

Updater:    S5 → S6 → S7
                  └─→ S8
```

Hai feature **độc lập hoàn toàn** — có thể develop song song.

### Complexity Summary

| Story | Feature | Complexity | Frontend-only? |
|-------|---------|------------|---------------|
| S1 | Terminal tabs UI | Thấp | ✅ |
| S2 | Terminal store multi-session | Trung bình | ✅ |
| S3 | Terminal tab rename | Thấp | ✅ |
| S4 | Terminal cleanup | Thấp | ✅ |
| S5 | Update check entry point | Thấp | ✅ |
| S6 | Update modal | Trung bình | ✅ |
| S7 | Download progress | Trung bình | ✅ (plugin API) |
| S8 | Startup redirect | Thấp | ✅ |

**Toàn bộ v1.2.0 là frontend work** — Rust backend đã đủ (`PtyStore` multi-session + `tauri-plugin-updater`).

### New Files (Expected)

```
src/components/TerminalTabBar.vue     (S1)
src/components/UpdateModal.vue        (S6)
src/stores/terminal.ts                (S2) — hoặc extend ui.ts
```

### Modified Files (Expected)

```
src/components/TerminalPanel.vue      (S1, S2, S4, S7)
src/components/AppHeader.vue          (S5)
src/stores/ui.ts hoặc terminal.ts     (S2)
```
