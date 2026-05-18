use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, RunEvent, State};
use walkdir::WalkDir;

#[derive(Serialize)]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub has_md: bool,
}

fn dir_has_md(path: &Path) -> bool {
    WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            e.file_name()
                .to_str()
                .map(|s| !s.starts_with('.'))
                .unwrap_or(true)
        })
        .filter_map(|e| e.ok())
        .any(|e| {
            e.file_type().is_file()
                && e.path()
                    .extension()
                    .map(|ext| ext.eq_ignore_ascii_case("md"))
                    .unwrap_or(false)
        })
}

fn is_md_file(path: &Path) -> bool {
    path.extension()
        .map(|ext| ext.eq_ignore_ascii_case("md"))
        .unwrap_or(false)
}

#[tauri::command]
fn list_dir(path: String) -> Result<Vec<FsEntry>, String> {
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Err(format!("path not found: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("not a directory: {}", path));
    }

    let mut entries: Vec<FsEntry> = std::fs::read_dir(&root)
        .map_err(|e| e.to_string())?
        .filter_map(|res| res.ok())
        .filter_map(|de| {
            let p = de.path();
            let name = de.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                return None;
            }
            let ft = de.file_type().ok()?;
            let is_dir = ft.is_dir();
            let has_md = if is_dir {
                dir_has_md(&p)
            } else {
                is_md_file(&p)
            };
            Some(FsEntry {
                name,
                path: p.to_string_lossy().to_string(),
                is_dir,
                has_md,
            })
        })
        .collect();

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    PathBuf::from(path).exists()
}

#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("{}: {}", path, e))
}

#[tauri::command]
fn write_text(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| format!("{}: {}", path, e))
}

#[derive(Serialize)]
pub struct MdFile {
    pub name: String,
    pub path: String,
    pub rel_path: String,
}

#[tauri::command]
fn list_md_files(root: String) -> Result<Vec<MdFile>, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("not a directory: {}", root));
    }
    let mut out: Vec<MdFile> = WalkDir::new(&root_path)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            e.file_name()
                .to_str()
                .map(|s| !s.starts_with('.'))
                .unwrap_or(true)
        })
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file() && is_md_file(e.path()))
        .map(|e| {
            let path = e.path().to_path_buf();
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let rel = path
                .strip_prefix(&root_path)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| path.to_string_lossy().to_string());
            MdFile {
                name,
                path: path.to_string_lossy().to_string(),
                rel_path: rel,
            }
        })
        .collect();
    out.sort_by_key(|a| a.name.to_lowercase());
    Ok(out)
}

#[tauri::command]
fn write_temp_html(html: String, base_name: Option<String>) -> Result<String, String> {
    use std::time::{SystemTime, UNIX_EPOCH};
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let stem = base_name
        .as_deref()
        .map(|s| {
            s.trim_end_matches(".md")
                .chars()
                .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
                .collect::<String>()
        })
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "preview".to_string());
    let filename = format!("mdview-{}-{}.html", stem, stamp);
    let mut path = std::env::temp_dir();
    path.push(filename);
    std::fs::write(&path, html).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

// ─── File management (v1.1) ────────────────────────────────────────────────

#[tauri::command]
fn create_md_file(dir: String, filename: String) -> Result<String, String> {
    let dir_p = PathBuf::from(&dir);
    if !dir_p.is_dir() {
        return Err(format!("not a directory: {}", dir));
    }
    let mut name = filename.trim().to_string();
    if name.is_empty() {
        return Err("empty filename".into());
    }
    if name.contains(['/', '\\']) {
        return Err("filename cannot contain path separators".into());
    }
    if !name.to_lowercase().ends_with(".md") {
        name.push_str(".md");
    }
    let target = dir_p.join(&name);
    if target.exists() {
        return Err(format!("file already exists: {}", name));
    }
    std::fs::write(&target, "").map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn rename_path(from: String, to: String) -> Result<(), String> {
    let from_p = PathBuf::from(&from);
    let to_p = PathBuf::from(&to);
    if !from_p.exists() {
        return Err(format!("source not found: {}", from));
    }
    if from_p == to_p {
        return Ok(());
    }
    if to_p.exists() {
        return Err(format!("target already exists: {}", to_p.display()));
    }
    std::fs::rename(&from_p, &to_p).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("not found: {}", path));
    }
    if p.is_dir() {
        return Err("cannot delete directory".into());
    }
    std::fs::remove_file(&p).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── .code-workspace parsing (v1.1) ────────────────────────────────────────

#[derive(Serialize)]
pub struct WorkspaceFolder {
    pub name: String,
    pub path: String,
    pub exists: bool,
}

#[derive(Serialize)]
pub struct CodeWorkspace {
    pub folders: Vec<WorkspaceFolder>,
}

fn strip_jsonc(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    let mut in_str = false;
    let mut escape = false;
    while i < bytes.len() {
        let c = bytes[i];
        if in_str {
            out.push(c as char);
            if escape {
                escape = false;
            } else if c == b'\\' {
                escape = true;
            } else if c == b'"' {
                in_str = false;
            }
            i += 1;
        } else if c == b'/' && i + 1 < bytes.len() && bytes[i + 1] == b'/' {
            while i < bytes.len() && bytes[i] != b'\n' {
                i += 1;
            }
        } else if c == b'/' && i + 1 < bytes.len() && bytes[i + 1] == b'*' {
            i += 2;
            while i + 1 < bytes.len() && !(bytes[i] == b'*' && bytes[i + 1] == b'/') {
                i += 1;
            }
            i = (i + 2).min(bytes.len());
        } else if c == b'"' {
            in_str = true;
            out.push(c as char);
            i += 1;
        } else {
            out.push(c as char);
            i += 1;
        }
    }
    out
}

#[tauri::command]
fn parse_code_workspace(path: String) -> Result<CodeWorkspace, String> {
    let p = PathBuf::from(&path);
    let raw = std::fs::read_to_string(&p).map_err(|e| format!("{}: {}", path, e))?;
    let cleaned = strip_jsonc(&raw);
    let v: serde_json::Value =
        serde_json::from_str(&cleaned).map_err(|e| format!("invalid .code-workspace: {}", e))?;
    let base = p.parent().unwrap_or(Path::new(""));
    let folders = v
        .get("folders")
        .and_then(|f| f.as_array())
        .cloned()
        .unwrap_or_default();
    let mut out = Vec::new();
    for f in folders {
        let raw_path = match f.get("path").and_then(|p| p.as_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };
        let resolved = if PathBuf::from(&raw_path).is_absolute() {
            PathBuf::from(&raw_path)
        } else {
            base.join(&raw_path)
        };
        let abs = resolved.canonicalize().unwrap_or(resolved);
        let name = f
            .get("name")
            .and_then(|n| n.as_str())
            .map(String::from)
            .unwrap_or_else(|| {
                abs.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| raw_path.clone())
            });
        let exists = abs.is_dir();
        out.push(WorkspaceFolder {
            name,
            path: abs.to_string_lossy().to_string(),
            exists,
        });
    }
    Ok(CodeWorkspace { folders: out })
}

// ─── PTY (v1.1) ────────────────────────────────────────────────────────────

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
pub struct PtyStore {
    sessions: Mutex<HashMap<u32, PtySession>>,
}

static PTY_ID: AtomicU32 = AtomicU32::new(1);

#[derive(Clone, Serialize)]
struct PtyDataPayload {
    id: u32,
    data: String,
}

#[derive(Clone, Serialize)]
struct PtyExitPayload {
    id: u32,
}

struct ShellSpec {
    program: String,
    args: Vec<String>,
}

#[allow(dead_code)]
fn find_in_path(exe: &str) -> Option<String> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        let full = dir.join(exe);
        if full.is_file() {
            return Some(full.to_string_lossy().to_string());
        }
    }
    None
}

#[cfg(windows)]
fn detect_shell() -> ShellSpec {
    for cand in &["pwsh.exe", "powershell.exe", "cmd.exe"] {
        if let Some(p) = find_in_path(cand) {
            return ShellSpec {
                program: p,
                args: vec![],
            };
        }
    }
    ShellSpec {
        program: "cmd.exe".into(),
        args: vec![],
    }
}

#[cfg(not(windows))]
fn detect_shell() -> ShellSpec {
    let prog = std::env::var("SHELL").unwrap_or_else(|_| {
        if PathBuf::from("/bin/zsh").exists() {
            "/bin/zsh".into()
        } else {
            "/bin/bash".into()
        }
    });
    ShellSpec {
        program: prog,
        args: vec![],
    }
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

#[tauri::command]
fn pty_spawn(
    app: AppHandle,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
    store: State<'_, PtyStore>,
) -> Result<u32, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell = detect_shell();
    let mut cmd = CommandBuilder::new(&shell.program);
    for a in &shell.args {
        cmd.arg(a);
    }
    let working_dir = cwd
        .as_ref()
        .map(PathBuf::from)
        .filter(|p| p.is_dir())
        .or_else(home_dir);
    if let Some(d) = working_dir {
        cmd.cwd(d);
    }
    cmd.env("TERM", "xterm-256color");

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

    let id = PTY_ID.fetch_add(1, Ordering::SeqCst);

    {
        let mut map = store.sessions.lock().map_err(|e| e.to_string())?;
        map.insert(
            id,
            PtySession {
                master: pair.master,
                writer,
                child,
            },
        );
    }

    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).into_owned();
                    let _ = app_handle.emit("pty-data", PtyDataPayload { id, data: chunk });
                }
                Err(_) => break,
            }
        }
        let _ = app_handle.emit("pty-exit", PtyExitPayload { id });
        if let Some(state) = app_handle.try_state::<PtyStore>() {
            if let Ok(mut map) = state.sessions.lock() {
                map.remove(&id);
            }
        }
    });

    Ok(id)
}

#[tauri::command]
fn pty_write(id: u32, data: String, store: State<'_, PtyStore>) -> Result<(), String> {
    let mut map = store.sessions.lock().map_err(|e| e.to_string())?;
    let session = map.get_mut(&id).ok_or_else(|| "pty not found".to_string())?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn pty_resize(id: u32, cols: u16, rows: u16, store: State<'_, PtyStore>) -> Result<(), String> {
    let map = store.sessions.lock().map_err(|e| e.to_string())?;
    let session = map.get(&id).ok_or_else(|| "pty not found".to_string())?;
    session
        .master
        .resize(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn pty_kill(id: u32, store: State<'_, PtyStore>) -> Result<(), String> {
    let mut map = store.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = map.remove(&id) {
        let _ = session.child.kill();
    }
    Ok(())
}

// ─── File-association open handling (v1.1) ─────────────────────────────────

#[derive(Default)]
pub struct PendingOpens {
    paths: Mutex<Vec<String>>,
}

fn is_markdown_path(p: &str) -> bool {
    let lower = p.to_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown")
}

fn collect_md_paths<I: IntoIterator<Item = String>>(args: I) -> Vec<String> {
    args.into_iter()
        .filter(|p| is_markdown_path(p) && Path::new(p).exists())
        .collect()
}

fn push_pending(app: &AppHandle, path: String) {
    if let Some(state) = app.try_state::<PendingOpens>() {
        if let Ok(mut g) = state.paths.lock() {
            g.push(path);
        }
    }
}

#[tauri::command]
fn consume_pending_open_files(state: State<'_, PendingOpens>) -> Vec<String> {
    if let Ok(mut g) = state.paths.lock() {
        std::mem::take(&mut *g)
    } else {
        Vec::new()
    }
}

fn focus_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

// ─── App entry ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_files = collect_md_paths(std::env::args().skip(1));

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let mds = collect_md_paths(args.into_iter().skip(1));
            for p in mds {
                push_pending(app, p.clone());
                let _ = app.emit("open-file-request", p);
            }
            focus_main_window(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(PtyStore::default())
        .manage(PendingOpens::default())
        .setup(move |app| {
            if !initial_files.is_empty() {
                if let Some(state) = app.try_state::<PendingOpens>() {
                    if let Ok(mut g) = state.paths.lock() {
                        g.extend(initial_files.iter().cloned());
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_dir,
            path_exists,
            read_text,
            write_text,
            list_md_files,
            write_temp_html,
            create_md_file,
            rename_path,
            delete_file,
            parse_code_workspace,
            pty_spawn,
            pty_write,
            pty_resize,
            pty_kill,
            consume_pending_open_files,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        handle_run_event(app_handle, event);
    });
}

#[cfg(target_os = "macos")]
fn handle_run_event(app_handle: &AppHandle, event: RunEvent) {
    if let RunEvent::Opened { urls } = event {
        for url in urls {
            if let Ok(p) = url.to_file_path() {
                let path = p.to_string_lossy().to_string();
                if is_markdown_path(&path) && p.exists() {
                    push_pending(app_handle, path.clone());
                    let _ = app_handle.emit("open-file-request", path);
                    focus_main_window(app_handle);
                }
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn handle_run_event(_app_handle: &AppHandle, _event: RunEvent) {}
