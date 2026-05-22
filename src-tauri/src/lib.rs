use once_cell::sync::Lazy;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use regex::Regex;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
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
    let raw = filename.trim();
    if raw.is_empty() {
        return Err("empty filename".into());
    }
    let segments: Vec<&str> = raw
        .split(['/', '\\'])
        .filter(|s| !s.is_empty())
        .collect();
    if segments.is_empty() {
        return Err("empty filename".into());
    }
    for seg in &segments {
        if *seg == "." || *seg == ".." {
            return Err("path segments '.' and '..' not allowed".into());
        }
    }
    let mut target_dir = dir_p.clone();
    if segments.len() > 1 {
        for seg in &segments[..segments.len() - 1] {
            target_dir.push(seg);
        }
        std::fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    }
    let mut name = segments[segments.len() - 1].to_string();
    if !name.to_lowercase().ends_with(".md") {
        name.push_str(".md");
    }
    let target = target_dir.join(&name);
    if target.exists() {
        return Err(format!("file already exists: {}", name));
    }
    std::fs::write(&target, "").map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn create_dir(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if p.exists() {
        return Err(format!("already exists: {}", path));
    }
    std::fs::create_dir_all(&p).map_err(|e| e.to_string())?;
    Ok(p.to_string_lossy().to_string())
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

// ─── Copy path (v1.5.0) ────────────────────────────────────────────────────

fn resolve_name_conflict(path: &Path) -> PathBuf {
    if !path.exists() {
        return path.to_path_buf();
    }
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = path
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let parent = path.parent().unwrap_or(Path::new("."));
    // Try stem-copy, then stem-copy-2, stem-copy-3, …
    let candidate = parent.join(format!("{}-copy{}", stem, ext));
    if !candidate.exists() {
        return candidate;
    }
    let mut counter = 2u32;
    loop {
        let candidate = parent.join(format!("{}-copy-{}{}", stem, counter, ext));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dest)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ft = entry.file_type()?;
        let dest_child = dest.join(entry.file_name());
        if ft.is_dir() {
            copy_dir_recursive(&entry.path(), &dest_child)?;
        } else {
            std::fs::copy(entry.path(), &dest_child)?;
        }
    }
    Ok(())
}

#[tauri::command]
fn copy_path(source: String, dest_dir: String) -> Result<String, String> {
    let src = Path::new(&source);
    let name = src
        .file_name()
        .ok_or("invalid source path")?
        .to_str()
        .ok_or("non-UTF8 file name")?;
    let raw_dest = PathBuf::from(&dest_dir).join(name);
    let dest = resolve_name_conflict(&raw_dest);
    if src.is_dir() {
        copy_dir_recursive(src, &dest).map_err(|e| e.to_string())?;
    } else {
        std::fs::copy(src, &dest).map_err(|e| e.to_string())?;
    }
    Ok(dest.to_string_lossy().to_string())
}

#[derive(Serialize)]
pub struct SearchResult {
    pub path: String,
    pub line_number: usize,
    pub line_content: String,
}

#[tauri::command]
fn search_workspace(query: String, roots: Vec<String>) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let query_lower = query.to_lowercase();
    let mut files = Vec::new();

    for root in roots {
        let root_path = PathBuf::from(&root);
        if !root_path.is_dir() {
            continue;
        }
        for entry in WalkDir::new(root_path)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                name != ".git" && name != "node_modules" && !name.starts_with('.')
            })
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() && is_md_file(entry.path()) {
                files.push(entry.path().to_path_buf());
            }
        }
    }

    if files.is_empty() {
        return Ok(Vec::new());
    }

    let num_threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    let files = std::sync::Arc::new(files);
    let query_lower = std::sync::Arc::new(query_lower);
    let mut handles = Vec::new();

    let chunk_size = files.len().div_ceil(num_threads);

    for i in 0..num_threads {
        let files = std::sync::Arc::clone(&files);
        let query_lower = std::sync::Arc::clone(&query_lower);
        
        let start = i * chunk_size;
        let end = (start + chunk_size).min(files.len());
        if start >= files.len() {
            break;
        }

        handles.push(std::thread::spawn(move || {
            let mut chunk_results = Vec::new();
            for file_path in &files[start..end] {
                if let Ok(content) = std::fs::read_to_string(file_path) {
                    for (idx, line) in content.lines().enumerate() {
                        if line.to_lowercase().contains(&*query_lower) {
                            chunk_results.push(SearchResult {
                                path: file_path.to_string_lossy().to_string(),
                                line_number: idx + 1,
                                line_content: line.to_string(),
                            });
                        }
                    }
                }
            }
            chunk_results
        }));
    }

    let mut results = Vec::new();
    for h in handles {
        if let Ok(mut r) = h.join() {
            results.append(&mut r);
        }
    }

    results.sort_by(|a, b| {
        a.path.cmp(&b.path).then_with(|| a.line_number.cmp(&b.line_number))
    });

    Ok(results)
}

// ─── Link graph (v1.8.0) ───────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct GraphNode {
    pub path: String,
    pub label: String,
    pub degree: u32,
    pub exists: bool,
}

#[derive(Serialize, Clone)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    pub kind: String,
    pub unresolved: bool,
}

#[derive(Serialize, Clone, Default)]
pub struct LinkGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Default)]
pub struct LinkGraphCache(Mutex<Option<CachedGraph>>);

pub struct CachedGraph {
    pub roots_key: String,
    pub graph: LinkGraph,
}

fn roots_signature(roots: &[String]) -> String {
    let mut copy: Vec<String> = roots.iter().map(|s| norm_slashes(s)).collect();
    copy.sort();
    copy.join("\n")
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub enum LinkKind {
    Wiki,
    Md,
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct ParsedLink {
    pub kind: LinkKind,
    pub target: String,
    pub line: usize,
}

static WIKI_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\[\[([^\]\|#\r\n]+)(?:[\|#][^\]\r\n]*)?\]\]").unwrap());
static MD_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[[^\]]*\]\(([^)\s#]+\.(?:md|markdown))(?:#[^)]*)?\)").unwrap()
});

fn norm_slashes(s: &str) -> String {
    s.replace('\\', "/")
}

pub fn parse_links_in_text(text: &str) -> Vec<ParsedLink> {
    let mut out = Vec::new();
    let mut fence_marker: Option<&str> = None;
    for (idx, line) in text.lines().enumerate() {
        let trimmed = line.trim_start();
        if let Some(open) = fence_marker {
            if trimmed.starts_with(open) {
                fence_marker = None;
            }
            continue;
        }
        if trimmed.starts_with("```") {
            fence_marker = Some("```");
            continue;
        }
        if trimmed.starts_with("~~~") {
            fence_marker = Some("~~~");
            continue;
        }
        for cap in WIKI_RE.captures_iter(line) {
            if let Some(m) = cap.get(1) {
                let t = m.as_str().trim().to_string();
                if !t.is_empty() {
                    out.push(ParsedLink {
                        kind: LinkKind::Wiki,
                        target: t,
                        line: idx + 1,
                    });
                }
            }
        }
        for cap in MD_RE.captures_iter(line) {
            if let Some(m) = cap.get(1) {
                let t = m.as_str().trim().to_string();
                if !t.is_empty() {
                    out.push(ParsedLink {
                        kind: LinkKind::Md,
                        target: t,
                        line: idx + 1,
                    });
                }
            }
        }
    }
    out
}

fn collect_md_files(roots: &[String]) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let mut seen: HashSet<PathBuf> = HashSet::new();
    for root in roots {
        let root_path = PathBuf::from(root);
        if !root_path.is_dir() {
            continue;
        }
        for entry in WalkDir::new(&root_path)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| {
                if e.depth() == 0 {
                    return true;
                }
                let name = e.file_name().to_string_lossy();
                name != ".git" && name != "node_modules" && !name.starts_with('.')
            })
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() && is_md_file(entry.path()) {
                let p = entry.path().to_path_buf();
                let key = p.canonicalize().unwrap_or_else(|_| p.clone());
                if seen.insert(key) {
                    files.push(p);
                }
            }
        }
    }
    files
}

fn resolve_wiki_target(
    name: &str,
    _source_dir: &Path,
    basename_index: &HashMap<String, PathBuf>,
) -> Option<PathBuf> {
    let mut candidate = name.to_string();
    if !candidate.to_lowercase().ends_with(".md")
        && !candidate.to_lowercase().ends_with(".markdown")
    {
        candidate.push_str(".md");
    }
    let lower = candidate.to_lowercase();
    basename_index.get(&lower).cloned()
}

fn resolve_md_target(rel: &str, source_dir: &Path) -> Option<PathBuf> {
    let p = source_dir.join(rel);
    if p.is_file() {
        return Some(p.canonicalize().unwrap_or(p));
    }
    None
}

fn label_for_path(p: &Path) -> String {
    p.file_stem()
        .or_else(|| p.file_name())
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| p.to_string_lossy().to_string())
}

fn build_graph_impl(files: Vec<PathBuf>) -> LinkGraph {
    if files.is_empty() {
        return LinkGraph::default();
    }
    let canonical: Vec<PathBuf> = files
        .iter()
        .map(|p| p.canonicalize().unwrap_or_else(|_| p.clone()))
        .collect();

    let mut basename_index: HashMap<String, PathBuf> = HashMap::new();
    for p in &canonical {
        if let Some(name) = p.file_name() {
            basename_index.insert(name.to_string_lossy().to_lowercase(), p.clone());
        }
    }

    let num_threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .max(1);
    let files_arc = std::sync::Arc::new(canonical.clone());
    let basename_arc = std::sync::Arc::new(basename_index);
    let chunk_size = files_arc.len().div_ceil(num_threads);

    let mut handles = Vec::new();
    for i in 0..num_threads {
        let start = i * chunk_size;
        if start >= files_arc.len() {
            break;
        }
        let end = (start + chunk_size).min(files_arc.len());
        let files_arc = std::sync::Arc::clone(&files_arc);
        let basename_arc = std::sync::Arc::clone(&basename_arc);

        handles.push(std::thread::spawn(move || {
            let mut local: Vec<GraphEdge> = Vec::new();
            for src in &files_arc[start..end] {
                let content = match std::fs::read_to_string(src) {
                    Ok(s) => s,
                    Err(e) => {
                        eprintln!("[graph] read {:?} failed: {}", src, e);
                        continue;
                    }
                };
                let src_dir = src.parent().unwrap_or(Path::new(""));
                let src_key = norm_slashes(&src.to_string_lossy());
                for link in parse_links_in_text(&content) {
                    let (resolved, kind_str) = match link.kind {
                        LinkKind::Wiki => (
                            resolve_wiki_target(&link.target, src_dir, &basename_arc),
                            "wiki",
                        ),
                        LinkKind::Md => (resolve_md_target(&link.target, src_dir), "md"),
                    };
                    let (target_key, unresolved) = match resolved {
                        Some(p) => (norm_slashes(&p.to_string_lossy()), false),
                        None => {
                            let raw = match link.kind {
                                LinkKind::Wiki => {
                                    let mut n = link.target.clone();
                                    if !n.to_lowercase().ends_with(".md")
                                        && !n.to_lowercase().ends_with(".markdown")
                                    {
                                        n.push_str(".md");
                                    }
                                    norm_slashes(&n)
                                }
                                LinkKind::Md => norm_slashes(&link.target),
                            };
                            (raw, true)
                        }
                    };
                    if target_key == src_key {
                        continue;
                    }
                    local.push(GraphEdge {
                        source: src_key.clone(),
                        target: target_key,
                        kind: kind_str.into(),
                        unresolved,
                    });
                }
            }
            local
        }));
    }

    let mut edges: Vec<GraphEdge> = Vec::new();
    for h in handles {
        if let Ok(mut chunk) = h.join() {
            edges.append(&mut chunk);
        }
    }

    let mut node_map: HashMap<String, GraphNode> = HashMap::new();
    for p in &canonical {
        let key = norm_slashes(&p.to_string_lossy());
        node_map.insert(
            key.clone(),
            GraphNode {
                path: key,
                label: label_for_path(p),
                degree: 0,
                exists: true,
            },
        );
    }
    for e in &edges {
        node_map.entry(e.source.clone()).and_modify(|n| n.degree += 1);
        node_map
            .entry(e.target.clone())
            .and_modify(|n| n.degree += 1)
            .or_insert_with(|| {
                let label_src = e.target.rsplit('/').next().unwrap_or(&e.target);
                let label = label_src
                    .trim_end_matches(".md")
                    .trim_end_matches(".markdown")
                    .to_string();
                GraphNode {
                    path: e.target.clone(),
                    label,
                    degree: 1,
                    exists: !e.unresolved,
                }
            });
    }

    let mut nodes: Vec<GraphNode> = node_map.into_values().collect();
    nodes.sort_by(|a, b| a.label.to_lowercase().cmp(&b.label.to_lowercase()));

    LinkGraph { nodes, edges }
}

#[tauri::command]
fn build_link_graph(
    roots: Vec<String>,
    refresh: bool,
    state: State<'_, LinkGraphCache>,
) -> Result<LinkGraph, String> {
    let key = roots_signature(&roots);
    if !refresh {
        if let Ok(guard) = state.0.lock() {
            if let Some(c) = guard.as_ref() {
                if c.roots_key == key {
                    return Ok(c.graph.clone());
                }
            }
        }
    }
    let files = collect_md_files(&roots);
    let graph = build_graph_impl(files);
    if let Ok(mut guard) = state.0.lock() {
        *guard = Some(CachedGraph {
            roots_key: key,
            graph: graph.clone(),
        });
    }
    Ok(graph)
}

// ─── Backlinks (v1.8.0 S-BL1) ──────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
pub struct BacklinkEntry {
    pub from_file: String,
    pub from_label: String,
    pub link_type: String,
    pub line_number: usize,
    pub context: String,
}

fn basename_index_from_graph(graph: &LinkGraph) -> HashMap<String, PathBuf> {
    let mut idx = HashMap::new();
    for node in &graph.nodes {
        if !node.exists {
            continue;
        }
        let pb = PathBuf::from(&node.path);
        if let Some(name) = pb.file_name() {
            idx.insert(name.to_string_lossy().to_lowercase(), pb);
        }
    }
    idx
}

fn build_backlink_entries(
    source_paths: &[String],
    target_key: &str,
    basename_index: &HashMap<String, PathBuf>,
) -> Vec<BacklinkEntry> {
    let mut out = Vec::new();
    for src in source_paths {
        let src_path = PathBuf::from(src);
        let content = match std::fs::read_to_string(&src_path) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[backlinks] read {:?} failed: {}", src_path, e);
                continue;
            }
        };
        let src_dir = src_path.parent().unwrap_or(Path::new(""));
        let lines: Vec<&str> = content.lines().collect();
        if lines.is_empty() {
            continue;
        }
        let label = label_for_path(&src_path);
        for link in parse_links_in_text(&content) {
            let (resolved, kind_str) = match link.kind {
                LinkKind::Wiki => (
                    resolve_wiki_target(&link.target, src_dir, basename_index),
                    "wiki",
                ),
                LinkKind::Md => (resolve_md_target(&link.target, src_dir), "md"),
            };
            let Some(resolved_path) = resolved else { continue };
            let resolved_key = norm_slashes(&resolved_path.to_string_lossy());
            if resolved_key != target_key {
                continue;
            }
            // link.line is 1-based and bounded by content.lines().count() == lines.len().
            let line_idx = link.line.saturating_sub(1).min(lines.len() - 1);
            let last = lines.len() - 1;
            let start = line_idx.saturating_sub(1);
            let end = (line_idx + 1).min(last);
            let start = start.min(end);
            let snippet = lines[start..=end]
                .iter()
                .map(|l| l.trim_end())
                .collect::<Vec<_>>()
                .join("\n");
            out.push(BacklinkEntry {
                from_file: norm_slashes(&src_path.to_string_lossy()),
                from_label: label.clone(),
                link_type: kind_str.into(),
                line_number: link.line,
                context: snippet,
            });
        }
    }
    out
}

#[tauri::command]
fn find_backlinks(
    file_path: String,
    roots: Vec<String>,
    state: State<'_, LinkGraphCache>,
) -> Result<Vec<BacklinkEntry>, String> {
    if file_path.is_empty() || roots.is_empty() {
        return Ok(Vec::new());
    }
    let target_pb = PathBuf::from(&file_path);
    let target_canon = target_pb
        .canonicalize()
        .unwrap_or_else(|_| target_pb.clone());
    let target_key = norm_slashes(&target_canon.to_string_lossy());

    let key = roots_signature(&roots);
    let cached: Option<LinkGraph> = {
        let guard = state.0.lock().map_err(|e| e.to_string())?;
        guard
            .as_ref()
            .filter(|c| c.roots_key == key)
            .map(|c| c.graph.clone())
    };
    let graph = match cached {
        Some(g) => g,
        None => {
            let files = collect_md_files(&roots);
            let g = build_graph_impl(files);
            let mut guard = state.0.lock().map_err(|e| e.to_string())?;
            *guard = Some(CachedGraph {
                roots_key: key,
                graph: g.clone(),
            });
            g
        }
    };

    let mut sources: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for edge in &graph.edges {
        if edge.target == target_key && seen.insert(edge.source.clone()) {
            sources.push(edge.source.clone());
        }
    }
    sources.sort();

    let basename_index = basename_index_from_graph(&graph);
    Ok(build_backlink_entries(&sources, &target_key, &basename_index))
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

// ─── Native menu (v1.3) ────────────────────────────────────────────────────

fn build_app_menu(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let settings_item = MenuItem::with_id(
        app,
        "settings",
        "Settings…",
        true,
        Some("CmdOrCtrl+,"),
    )?;

    #[cfg(target_os = "macos")]
    let menu = {
        let app_submenu = Submenu::with_items(
            app,
            "mdview",
            true,
            &[
                &PredefinedMenuItem::about(app, None, None)?,
                &PredefinedMenuItem::separator(app)?,
                &settings_item,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::services(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::hide(app, None)?,
                &PredefinedMenuItem::hide_others(app, None)?,
                &PredefinedMenuItem::show_all(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::quit(app, None)?,
            ],
        )?;
        let edit_submenu = Submenu::with_items(
            app,
            "Edit",
            true,
            &[
                &PredefinedMenuItem::undo(app, None)?,
                &PredefinedMenuItem::redo(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::cut(app, None)?,
                &PredefinedMenuItem::copy(app, None)?,
                &PredefinedMenuItem::paste(app, None)?,
                &PredefinedMenuItem::select_all(app, None)?,
            ],
        )?;
        Menu::with_items(app, &[&app_submenu, &edit_submenu])?
    };

    #[cfg(not(target_os = "macos"))]
    let menu = {
        let file_submenu = Submenu::with_items(
            app,
            "File",
            true,
            &[&settings_item, &PredefinedMenuItem::quit(app, None)?],
        )?;
        Menu::with_items(app, &[&file_submenu])?
    };

    app.set_menu(menu)?;
    Ok(())
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
        .manage(LinkGraphCache::default())
        .setup(move |app| {
            if !initial_files.is_empty() {
                if let Some(state) = app.try_state::<PendingOpens>() {
                    if let Ok(mut g) = state.paths.lock() {
                        g.extend(initial_files.iter().cloned());
                    }
                }
            }
            build_app_menu(app.handle())?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "settings" {
                let _ = app.emit("open-settings", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            list_dir,
            path_exists,
            read_text,
            write_text,
            list_md_files,
            write_temp_html,
            create_md_file,
            create_dir,
            rename_path,
            delete_file,
            parse_code_workspace,
            pty_spawn,
            pty_write,
            pty_resize,
            pty_kill,
            consume_pending_open_files,
            copy_path,
            search_workspace,
            build_link_graph,
            find_backlinks,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_basic_wiki_link() {
        let links = parse_links_in_text("see [[Other Note]] here");
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].kind, LinkKind::Wiki);
        assert_eq!(links[0].target, "Other Note");
        assert_eq!(links[0].line, 1);
    }

    #[test]
    fn parses_wiki_alias_and_strips_after_pipe() {
        let links = parse_links_in_text("link [[file|display name]] !");
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target, "file");
    }

    #[test]
    fn parses_wiki_heading_suffix_stripped() {
        let links = parse_links_in_text("[[file#heading]]");
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target, "file");
    }

    #[test]
    fn parses_md_link_with_heading_anchor() {
        let links = parse_links_in_text("see [text](./sub/foo.md#h2) end");
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].kind, LinkKind::Md);
        assert_eq!(links[0].target, "./sub/foo.md");
    }

    #[test]
    fn skips_links_inside_fenced_code_block() {
        let text = "before [[real]]\n```\n[[fake]]\n[t](inside.md)\n```\nafter [[real2]]";
        let links = parse_links_in_text(text);
        let targets: Vec<&str> = links.iter().map(|l| l.target.as_str()).collect();
        assert_eq!(targets, vec!["real", "real2"]);
    }

    #[test]
    fn skips_links_inside_tilde_fence() {
        let text = "[[a]]\n~~~\n[[b]]\n~~~\n[[c]]";
        let links = parse_links_in_text(text);
        let targets: Vec<&str> = links.iter().map(|l| l.target.as_str()).collect();
        assert_eq!(targets, vec!["a", "c"]);
    }

    #[test]
    fn fence_marker_mismatch_does_not_close_fence() {
        // ``` opens a fence; a stray ~~~ inside should NOT close it
        let text = "outer [[a]]\n```\nin1 [[fake1]]\n~~~ tricky line\nin2 [[fake2]]\n```\n[[b]]";
        let links = parse_links_in_text(text);
        let targets: Vec<&str> = links.iter().map(|l| l.target.as_str()).collect();
        assert_eq!(targets, vec!["a", "b"]);
    }

    #[test]
    fn roots_signature_order_independent() {
        let a = roots_signature(&["/a".into(), "/b".into()]);
        let b = roots_signature(&["/b".into(), "/a".into()]);
        assert_eq!(a, b);
    }

    #[test]
    fn multiple_links_on_single_line() {
        let links = parse_links_in_text("[[a]] and [[b|alias]] and [t](./c.md)");
        assert_eq!(links.len(), 3);
        assert_eq!(links[0].target, "a");
        assert_eq!(links[1].target, "b");
        assert_eq!(links[2].target, "./c.md");
    }

    #[test]
    fn ignores_md_link_without_md_extension() {
        let links = parse_links_in_text("[t](https://example.com) and [t](./x.png)");
        assert!(links.is_empty());
    }

    #[test]
    fn build_graph_handles_empty_input() {
        let g = build_graph_impl(vec![]);
        assert!(g.nodes.is_empty());
        assert!(g.edges.is_empty());
    }

    #[test]
    fn parses_link_line_number() {
        let text = "line1\nline2 has [[target]]\nline3";
        let links = parse_links_in_text(text);
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].line, 2);
    }

    use std::io::Write;

    fn write_tmp_file(dir: &Path, name: &str, content: &str) -> PathBuf {
        let p = dir.join(name);
        let mut f = std::fs::File::create(&p).unwrap();
        f.write_all(content.as_bytes()).unwrap();
        p.canonicalize().unwrap()
    }

    fn mk_index(target: &Path) -> HashMap<String, PathBuf> {
        let mut idx = HashMap::new();
        if let Some(name) = target.file_name() {
            idx.insert(name.to_string_lossy().to_lowercase(), target.to_path_buf());
        }
        idx
    }

    #[test]
    fn find_backlinks_happy_path_wiki_and_md() {
        let tmp = std::env::temp_dir().join(format!("mdview_bl_test_{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();
        let target = write_tmp_file(&tmp, "B.md", "# B\nbody\n");
        let target_key = norm_slashes(&target.to_string_lossy());
        write_tmp_file(&tmp, "A.md", "intro line\nrefer to [[B]]\noutro\n");
        write_tmp_file(
            &tmp,
            "C.md",
            "header\nsee [target](./B.md) for context\nfinal\n",
        );

        let idx = mk_index(&target);
        let entries = build_backlink_entries(
            &[
                norm_slashes(&tmp.join("A.md").canonicalize().unwrap().to_string_lossy()),
                norm_slashes(&tmp.join("C.md").canonicalize().unwrap().to_string_lossy()),
            ],
            &target_key,
            &idx,
        );
        assert_eq!(entries.len(), 2);
        let kinds: Vec<&str> = entries.iter().map(|e| e.link_type.as_str()).collect();
        assert!(kinds.contains(&"wiki"));
        assert!(kinds.contains(&"md"));
        for e in &entries {
            assert_eq!(e.line_number, 2);
            assert!(e.context.contains(" "));
            assert!(e.context.lines().count() <= 3);
        }
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn find_backlinks_no_backlinks_returns_empty() {
        let tmp =
            std::env::temp_dir().join(format!("mdview_bl_test_empty_{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();
        let target = write_tmp_file(&tmp, "Lonely.md", "no inbound\n");
        let target_key = norm_slashes(&target.to_string_lossy());
        write_tmp_file(&tmp, "Other.md", "no links here\n");

        let idx = mk_index(&target);
        let entries = build_backlink_entries(
            &[norm_slashes(
                &tmp.join("Other.md")
                    .canonicalize()
                    .unwrap()
                    .to_string_lossy(),
            )],
            &target_key,
            &idx,
        );
        assert!(entries.is_empty());
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn find_backlinks_skips_missing_source_file() {
        let tmp =
            std::env::temp_dir().join(format!("mdview_bl_test_missing_{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();
        let target = write_tmp_file(&tmp, "T.md", "x\n");
        let target_key = norm_slashes(&target.to_string_lossy());
        let bogus = norm_slashes(&tmp.join("does-not-exist.md").to_string_lossy());

        let idx = mk_index(&target);
        let entries = build_backlink_entries(&[bogus], &target_key, &idx);
        assert!(entries.is_empty());
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn find_backlinks_context_snippet_three_line_window() {
        let tmp =
            std::env::temp_dir().join(format!("mdview_bl_test_ctx_{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();
        let target = write_tmp_file(&tmp, "T2.md", "x\n");
        let target_key = norm_slashes(&target.to_string_lossy());
        let src = write_tmp_file(
            &tmp,
            "Src.md",
            "before context\nthis line mentions [[T2]]\nafter context\nunrelated\n",
        );
        let idx = mk_index(&target);
        let entries =
            build_backlink_entries(&[norm_slashes(&src.to_string_lossy())], &target_key, &idx);
        assert_eq!(entries.len(), 1);
        let ctx = &entries[0].context;
        assert!(ctx.contains("before context"));
        assert!(ctx.contains("[[T2]]"));
        assert!(ctx.contains("after context"));
        assert!(!ctx.contains("unrelated"));
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn find_backlinks_normalizes_backslash_path() {
        let tmp =
            std::env::temp_dir().join(format!("mdview_bl_test_winpath_{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();
        let target = write_tmp_file(&tmp, "Win.md", "content\n");
        let target_key = norm_slashes(&target.to_string_lossy());
        // simulate a Windows-style path string (backslashes) for the target — emulating what
        // the frontend would pass before any normalization
        let win_style = target.to_string_lossy().replace('/', "\\");
        let normalized = norm_slashes(&win_style);
        assert_eq!(normalized, target_key);
        // and confirm a backlink lookup with this normalized key still matches.
        let src = write_tmp_file(&tmp, "Src.md", "hi\nlink [[Win]]\nbye\n");
        let idx = mk_index(&target);
        let entries =
            build_backlink_entries(&[norm_slashes(&src.to_string_lossy())], &normalized, &idx);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].link_type, "wiki");
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn find_backlinks_basename_collision_uses_full_graph_index() {
        // Two files share basename "B.md" in different dirs. When backlinks queried for
        // dirA/B.md, a source linking [[B]] resolves via basename_index — the lookup
        // must use the *workspace-wide* index so a link to "dirB/B.md" doesn't get
        // mis-attributed as a backlink to "dirA/B.md".
        let tmp = std::env::temp_dir()
            .join(format!("mdview_bl_test_collision_{}", std::process::id()));
        std::fs::create_dir_all(tmp.join("a")).unwrap();
        std::fs::create_dir_all(tmp.join("b")).unwrap();
        let target_a = write_tmp_file(&tmp.join("a"), "B.md", "A side\n");
        let target_b = write_tmp_file(&tmp.join("b"), "B.md", "B side\n");
        let src = write_tmp_file(&tmp, "Src.md", "x\nlink [[B]]\ny\n");

        // Full index has both — last-wins map mirrors build_graph_impl behavior.
        let mut idx: HashMap<String, PathBuf> = HashMap::new();
        idx.insert("b.md".to_string(), target_a.clone());
        // overwrite to simulate "other" winning
        idx.insert("b.md".to_string(), target_b.clone());

        let target_a_key = norm_slashes(&target_a.to_string_lossy());
        let entries = build_backlink_entries(
            &[norm_slashes(&src.to_string_lossy())],
            &target_a_key,
            &idx,
        );
        // Resolves to target_b, NOT target_a — so backlink list for target_a is empty.
        assert!(entries.is_empty());
        std::fs::remove_dir_all(&tmp).ok();
    }
}
