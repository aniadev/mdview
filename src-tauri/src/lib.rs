use serde::Serialize;
use std::path::{Path, PathBuf};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            list_dir,
            path_exists,
            read_text,
            write_text,
            list_md_files,
            write_temp_html
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
