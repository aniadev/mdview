import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { load, Store } from "@tauri-apps/plugin-store";
import type {
  CodeWorkspace,
  FsEntry,
  TreeNode,
  WorkspaceRoot,
} from "../types";
import { useTabsStore } from "./tabs";
import { useUiStore } from "./ui";
import { useI18n } from "../i18n";

const STORE_FILE = "mdview-settings.json";
const KEY_WORKSPACE_PATH = "workspace_path"; // legacy single-folder
const KEY_WORKSPACE_FILE = "workspace_file"; // path to .code-workspace
const KEY_RECENT_WORKSPACES = "recent_workspaces";

function basename(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] || p;
}

async function listDir(path: string): Promise<TreeNode[]> {
  const entries = await invoke<FsEntry[]>("list_dir", { path });
  return entries.map((e) => ({ ...e, expanded: false, loading: false }));
}

export const useWorkspaceStore = defineStore("workspace", () => {
  const roots = ref<WorkspaceRoot[]>([]);
  const workspaceFile = ref<string | null>(null);
  const error = ref<string | null>(null);
  const loading = ref(false);
  const recentWorkspaces = ref<string[]>([]);
  let store: Store | null = null;

  const hasWorkspace = computed(() => roots.value.length > 0);

  const displayName = computed(() => {
    if (workspaceFile.value) {
      return basename(workspaceFile.value).replace(/\.code-workspace$/i, "");
    }
    if (roots.value.length === 1) return roots.value[0].name;
    if (roots.value.length > 1) return `${roots.value.length} folders`;
    return "";
  });

  // Backward compat: existing code reads `rootPath`. Keep it pointing at first root.
  const rootPath = computed<string | null>(() =>
    roots.value[0]?.path ?? null
  );

  const rootPaths = computed<string[]>(() => roots.value.map((r) => r.path));

  const hasAnyMd = computed(() =>
    roots.value.some((r) => r.children.some((c) => c.has_md))
  );

  async function getStore(): Promise<Store> {
    if (!store) store = await load(STORE_FILE, { autoSave: true, defaults: {} });
    return store;
  }

  function addRecent(path: string) {
    recentWorkspaces.value = [path, ...recentWorkspaces.value.filter((p) => p !== path)].slice(0, 10);
    void getStore().then((s) => {
      s.set(KEY_RECENT_WORKSPACES, recentWorkspaces.value);
      s.save();
    });
  }

  async function loadSingleRoot(path: string): Promise<WorkspaceRoot> {
    const root: WorkspaceRoot = {
      path,
      name: basename(path),
      exists: true,
      loading: true,
      loadError: null,
      children: [],
    };
    try {
      root.children = await listDir(path);
    } catch (e) {
      root.loadError = String(e);
      root.exists = false;
    } finally {
      root.loading = false;
    }
    addRecent(path);
    return root;
  }

  async function openFolder(path: string) {
    loading.value = true;
    error.value = null;
    try {
      const root = await loadSingleRoot(path);
      roots.value = [root];
      workspaceFile.value = null;
      const s = await getStore();
      await s.set(KEY_WORKSPACE_PATH, path);
      await s.delete(KEY_WORKSPACE_FILE);
      await s.save();
      addRecent(path);
    } finally {
      loading.value = false;
    }
  }

  async function openWorkspaceFile(filePath: string) {
    loading.value = true;
    error.value = null;
    try {
      const ws = await invoke<CodeWorkspace>("parse_code_workspace", {
        path: filePath,
      });
      const loaded: WorkspaceRoot[] = [];
      for (const f of ws.folders) {
        if (!f.exists) {
          loaded.push({
            path: f.path,
            name: f.name,
            exists: false,
            loading: false,
            loadError: "folder not found",
            children: [],
          });
          continue;
        }
        const root = await loadSingleRoot(f.path);
        root.name = f.name || root.name;
        loaded.push(root);
      }
      roots.value = loaded;
      workspaceFile.value = filePath;
      const s = await getStore();
      await s.set(KEY_WORKSPACE_FILE, filePath);
      await s.delete(KEY_WORKSPACE_PATH);
      await s.save();
    } catch (e) {
      error.value = String(e);
    } finally {
      loading.value = false;
    }
    addRecent(filePath);
  }

  async function addWorkspace() {
    const selected = await open({
      directory: false,
      multiple: false,
      title: "Select folder or .code-workspace file",
      filters: [{ name: "Workspace", extensions: ["code-workspace"] }],
    });
    if (!selected || typeof selected !== "string") {
      // Fallback: directory picker if user wants a folder
      const folder = await open({
        directory: true,
        multiple: false,
        title: "Select workspace folder",
      });
      if (!folder || typeof folder !== "string") return;
      await openFolder(folder);
      return;
    }
    if (selected.toLowerCase().endsWith(".code-workspace")) {
      await openWorkspaceFile(selected);
    } else {
      await openFolder(selected);
    }
  }

  async function addFolderDirect() {
    const folder = await open({
      directory: true,
      multiple: false,
      title: "Select workspace folder",
    });
    if (!folder || typeof folder !== "string") return;
    await openFolder(folder);
  }

  async function removeWorkspace() {
    roots.value = [];
    workspaceFile.value = null;
    error.value = null;
    const s = await getStore();
    await s.delete(KEY_WORKSPACE_PATH);
    await s.delete(KEY_WORKSPACE_FILE);
    await s.save();
  }

  async function restoreWorkspace() {
    const s = await getStore();
    const recent = await s.get<string[]>(KEY_RECENT_WORKSPACES);
    if (recent && Array.isArray(recent)) recentWorkspaces.value = recent.slice(0, 10);
    const savedFile = await s.get<string>(KEY_WORKSPACE_FILE);
    if (savedFile) {
      const exists = await invoke<boolean>("path_exists", { path: savedFile });
      if (!exists) {
        error.value = `Workspace file not found: ${savedFile}`;
        return;
      }
      await openWorkspaceFile(savedFile);
      return;
    }
    const savedPath = await s.get<string>(KEY_WORKSPACE_PATH);
    if (!savedPath) return;
    const exists = await invoke<boolean>("path_exists", { path: savedPath });
    if (!exists) {
      error.value = `Workspace folder not found: ${savedPath}`;
      return;
    }
    await openFolder(savedPath);
  }

  async function toggleDir(node: TreeNode) {
    if (!node.is_dir) return;
    if (node.expanded) {
      node.expanded = false;
      return;
    }
    if (!node.children) {
      node.loading = true;
      try {
        node.children = await listDir(node.path);
      } catch (e) {
        error.value = String(e);
      } finally {
        node.loading = false;
      }
    }
    node.expanded = true;
  }

  async function ensureDirExpanded(path: string): Promise<void> {
    const normalized = path.replace(/\\/g, "/");
    const node = findNodeByPath(normalized);
    if (!node || !node.is_dir || node.expanded) return;
    if (!node.children) {
      node.loading = true;
      try {
        node.children = await listDir(node.path);
      } catch (e) {
        error.value = String(e);
        node.loading = false;
        return;
      }
      node.loading = false;
    }
    node.expanded = true;
  }

  async function expandPathToNode(targetFilePath: string) {
    const normalized = targetFilePath.replace(/\\/g, "/");
    
    // Find absolute parents/ancestors
    // E.g., targetFilePath = "/Users/name/doc/nested/file.md"
    // We want to expand:
    // 1. Walk through roots
    // Let's identify which root this file belongs to.
    let activeRoot = null;
    for (const root of roots.value) {
      const rootNorm = root.path.replace(/\\/g, "/");
      if (normalized.startsWith(rootNorm + "/")) {
        activeRoot = root;
        break;
      }
    }
    if (!activeRoot) return;

    // Split path into segments from root
    const rootNorm = activeRoot.path.replace(/\\/g, "/");
    const relativePart = normalized.substring(rootNorm.length + 1);
    const segments = relativePart.split("/");
    // We will build ancestral paths sequentially:
    // rootNorm/segments[0], rootNorm/segments[0]/segments[1], etc. (excluding the file itself)
    let currentPath = rootNorm;
    for (let i = 0; i < segments.length - 1; i++) {
      currentPath += "/" + segments[i];
      await ensureDirExpanded(currentPath);
    }
  }

  function findNodeByPath(target: string): TreeNode | null {
    function walk(nodes: TreeNode[]): TreeNode | null {
      for (const n of nodes) {
        if (n.path === target) return n;
        if (n.children) {
          const hit = walk(n.children);
          if (hit) return hit;
        }
      }
      return null;
    }
    for (const r of roots.value) {
      const hit = walk(r.children);
      if (hit) return hit;
    }
    return null;
  }

  async function refreshNodeChildren(node: TreeNode) {
    if (!node.is_dir) return;
    try {
      node.children = await listDir(node.path);
      node.expanded = true;
    } catch (e) {
      error.value = String(e);
    }
  }

  async function refreshRoot(rootPathVal: string) {
    const r = roots.value.find((x) => x.path === rootPathVal);
    if (!r) return;
    try {
      r.children = await listDir(rootPathVal);
    } catch (e) {
      error.value = String(e);
    }
  }

  function collectExpandedPaths(nodes: TreeNode[]): string[] {
    const paths: string[] = [];
    for (const n of nodes) {
      if (n.expanded && n.is_dir) paths.push(n.path);
      if (n.children) paths.push(...collectExpandedPaths(n.children));
    }
    return paths;
  }

  async function reExpandPaths(nodes: TreeNode[], expandedPaths: string[]): Promise<void> {
    for (const node of nodes) {
      if (expandedPaths.includes(node.path) && node.is_dir) {
        try {
          node.children = await listDir(node.path);
        } catch {
          /* keep old children */
        }
        node.expanded = true;
        if (node.children) await reExpandPaths(node.children, expandedPaths);
      }
    }
  }

  async function refreshRootPreservingState(rootPathVal: string) {
    const r = roots.value.find((x) => x.path === rootPathVal);
    if (!r) return;
    try {
      const expanded = collectExpandedPaths(r.children);
      r.children = await listDir(rootPathVal);
      await reExpandPaths(r.children, expanded);
    } catch (e) {
      error.value = String(e);
    }
  }

  function dirContainingPath(filePath: string): string {
    const norm = filePath.replace(/\\/g, "/");
    const idx = norm.lastIndexOf("/");
    return idx >= 0 ? norm.slice(0, idx) : "";
  }

  async function refreshDir(dirPath: string) {
    const norm = dirPath.replace(/\\/g, "/");
    const rootMatch = roots.value.find((r) => r.path === norm);
    if (rootMatch) {
      await refreshRootPreservingState(norm);
      return;
    }
    const node = findNodeByPath(norm);
    if (node) await refreshNodeChildren(node);
  }

  async function refreshParentOf(filePath: string) {
    await refreshDir(dirContainingPath(filePath));
  }

  async function refreshUniqueParentsOf(filePaths: string[]) {
    const parents = new Set(filePaths.map(dirContainingPath));
    for (const p of parents) await refreshDir(p);
  }

  async function createMdFile(
    parentDir: string,
    filename: string
  ): Promise<string> {
    const newPath = await invoke<string>("create_md_file", {
      dir: parentDir,
      filename,
    });
    const parentNode = findNodeByPath(parentDir);
    if (parentNode) await refreshNodeChildren(parentNode);
    else await refreshRoot(parentDir);
    return newPath;
  }

  async function createDir(
    parentDir: string,
    name: string
  ): Promise<string> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("empty folder name");
    if (trimmed.includes("/") || trimmed.includes("\\")) {
      throw new Error("folder name cannot contain path separators");
    }
    const target = `${parentDir.replace(/\\/g, "/")}/${trimmed}`;
    const newPath = await invoke<string>("create_dir", { path: target });
    const parentNode = findNodeByPath(parentDir);
    if (parentNode) await refreshNodeChildren(parentNode);
    else await refreshRoot(parentDir);
    const newNode = findNodeByPath(newPath);
    if (newNode) await toggleDir(newNode);
    return newPath;
  }

  async function renameMdFile(
    oldPath: string,
    newFilename: string
  ): Promise<string> {
    let name = newFilename.trim();
    if (!name) throw new Error("empty filename");
    if (!name.toLowerCase().endsWith(".md")) name += ".md";
    const parent = dirContainingPath(oldPath);
    const newPath = `${parent}/${name}`;
    if (newPath === oldPath) return oldPath;
    await invoke("rename_path", { from: oldPath, to: newPath });
    await refreshParentOf(newPath);
    return newPath;
  }

  async function deleteMdFile(path: string): Promise<void> {
    await invoke("delete_file", { path });
    await refreshParentOf(path);
  }

  async function deleteMdFilesBatch(paths: string[]): Promise<void> {
    for (const p of paths) {
      try {
        await invoke("delete_file", { path: p });
        useTabsStore().handleFileDeleted(p);
      } catch (e) {
        error.value = String(e);
      }
    }
    await refreshUniqueParentsOf(paths);
  }

  async function copyFile(source: string, destDir: string): Promise<string> {
    const newPath = await invoke<string>("copy_path", { source, destDir });
    await refreshParentOf(newPath);
    return newPath;
  }

  async function copyFilesBatch(sources: string[], destDir: string): Promise<void> {
    const newPaths: string[] = [];
    const movedSources: string[] = [];
    for (const source of sources) {
      try {
        const newPath = await invoke<string>("copy_path", { source, destDir });
        newPaths.push(newPath);
      } catch (e) {
        error.value = String(e);
      }
    }
    if (newPaths.length > 0) await refreshDir(destDir);
    if (movedSources.length > 0) await refreshUniqueParentsOf(movedSources);
  }

  async function moveFilesBatch(sources: string[], destDir: string): Promise<void> {
    const movedSources: string[] = [];
    const newPaths: string[] = [];
    for (const source of sources) {
      try {
        const newPath = await invoke<string>("copy_path", { source, destDir });
        await invoke("delete_file", { path: source });
        const tabsStore = useTabsStore();
        const newName = newPath.replace(/\\/g, "/").split("/").pop() ?? newPath;
        tabsStore.handleFileRenamed(source, newPath, newName);
        movedSources.push(source);
        newPaths.push(newPath);
      } catch (e) {
        error.value = String(e);
      }
    }
    const allPaths = [...movedSources, ...newPaths];
    if (allPaths.length > 0) await refreshUniqueParentsOf(allPaths);
  }

  async function moveFile(source: string, destDir: string): Promise<string> {
    const newPath = await invoke<string>("copy_path", { source, destDir });
    // Delete the original after successful copy
    await invoke("delete_file", { path: source });
    // Refresh both source parent and destination parent
    await refreshUniqueParentsOf([source, newPath]);
    // Update any open tab pointing to the old path
    const tabsStore = useTabsStore();
    const newName = newPath.replace(/\\/g, "/").split("/").pop() ?? newPath;
    tabsStore.handleFileRenamed(source, newPath, newName);
    return newPath;
  }

  function dirname(p: string): string {
    const norm = p.replace(/\\/g, "/");
    const idx = norm.lastIndexOf("/");
    return idx > 0 ? norm.slice(0, idx) : norm;
  }

  function relativize(target: string, base: string): string {
    const t = target.replace(/\\/g, "/").split("/").filter(Boolean);
    const b = base.replace(/\\/g, "/").split("/").filter(Boolean);
    let common = 0;
    while (common < t.length && common < b.length && t[common] === b[common]) common++;
    if (common === 0) return target;
    const up = b.length - common;
    const down = t.slice(common);
    if (up === 0 && down.length === 0) return ".";
    const parts = Array(up).fill("..").concat(down);
    return parts.join("/");
  }

  function serializeWorkspace(filePath: string): string {
    const baseDir = dirname(filePath);
    const folders = roots.value.map((r) => {
      const rel = relativize(r.path, baseDir);
      const usable =
        rel && !rel.startsWith("..") && rel.length < r.path.length ? rel : r.path;
      return { name: r.name, path: usable };
    });
    return JSON.stringify({ folders }, null, 2) + "\n";
  }

  async function saveCurrentWorkspace(): Promise<boolean> {
    if (!workspaceFile.value) return false;
    const json = serializeWorkspace(workspaceFile.value);
    await invoke("write_text", { path: workspaceFile.value, contents: json });
    return true;
  }

  async function saveAsNewWorkspace(): Promise<boolean> {
    const selected = await save({
      title: "Save Workspace As",
      defaultPath: "workspace.code-workspace",
      filters: [{ name: "Workspace", extensions: ["code-workspace"] }],
    });
    if (!selected || typeof selected !== "string") return false;
    const json = serializeWorkspace(selected);
    await invoke("write_text", { path: selected, contents: json });
    workspaceFile.value = selected;
    const s = await getStore();
    await s.set(KEY_WORKSPACE_FILE, selected);
    await s.delete(KEY_WORKSPACE_PATH);
    await s.save();
    return true;
  }

  async function addFolderToCurrentWorkspace(): Promise<void> {
    const folder = await open({
      directory: true,
      multiple: false,
      title: "Add folder to workspace",
    });
    if (!folder || typeof folder !== "string") return;
    if (roots.value.some((r) => r.path === folder)) return;
    const root = await loadSingleRoot(folder);
    roots.value.push(root);
    if (workspaceFile.value) {
      try {
        await saveCurrentWorkspace();
      } catch (e) {
        error.value = String(e);
      }
    } else {
      const s = await getStore();
      if (roots.value.length === 1) {
        await s.set(KEY_WORKSPACE_PATH, folder);
        await s.save();
      } else {
        await s.delete(KEY_WORKSPACE_PATH);
        await s.save();
      }
    }
  }

  async function removeRoot(rootPathVal: string) {
    const tabs = useTabsStore();
    const rootPathNorm = rootPathVal.replace(/\\/g, "/");
    const tabsToClose = tabs.tabs.filter((t) => {
      const tabPathNorm = t.path.replace(/\\/g, "/");
      return tabPathNorm.startsWith(rootPathNorm + "/") || tabPathNorm === rootPathNorm;
    });
    for (const tab of tabsToClose) {
      await tabs.closeTab(tab.path);
    }
    roots.value = roots.value.filter((r) => r.path !== rootPathVal);
    const s = await getStore();
    if (roots.value.length === 0) {
      workspaceFile.value = null;
      error.value = null;
      await s.delete(KEY_WORKSPACE_PATH);
      await s.delete(KEY_WORKSPACE_FILE);
      await s.save();
    } else if (roots.value.length === 1) {
      workspaceFile.value = null;
      await s.set(KEY_WORKSPACE_PATH, roots.value[0].path);
      await s.delete(KEY_WORKSPACE_FILE);
      await s.save();
    } else {
      if (workspaceFile.value) {
        try {
          await saveCurrentWorkspace();
        } catch (e) {
          error.value = String(e);
        }
      }
    }
  }

  async function openDailyNote() {
    error.value = null;
    try {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const date = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${date}`;

      const store = await load("mdview-settings.json", { autoSave: true, defaults: {} });
      const configFolder = await store.get<string>("daily_notes_folder");
      
      const targetDir = configFolder ? configFolder.trim() : rootPath.value;
      if (!targetDir) {
        error.value = "Chưa mở thư mục workspace nào để tạo Daily Note. / No workspace folder opened to create Daily Note.";
        return;
      }

      // Ensure directory format and normalize separators
      const normalizedDir = targetDir.replace(/\\/g, "/");
      const filePath = `${normalizedDir}/${dateStr}.md`;

      const exists = await invoke<boolean>("path_exists", { path: filePath });
      if (!exists) {
        // Create file with locale-appropriate template
        const { currentLocale } = useI18n();
        const isVi = currentLocale.value === "vi";
        const heading = isVi ? `# Nhật ký Ngày ${dateStr}` : `# Daily Note ${dateStr}`;
        const placeholder = isVi ? "- Viết tại đây..." : "- Write here...";
        const initialContent = `${heading}\n\n${placeholder}\n`;

        await invoke("write_text", { path: filePath, contents: initialContent });
        
        // Refresh workspace files
        await refreshDir(normalizedDir);
      }

      // Open tab
      const fileName = `${dateStr}.md`;
      const tabsStore = useTabsStore();
      await tabsStore.openFile(filePath, fileName);

      // Wait a tiny bit and focus/scroll to the bottom of the file
      const uiStore = useUiStore();
      setTimeout(() => {
        uiStore.targetLine = -1; // -1 represents scroll to bottom and focus
      }, 100);

    } catch (e) {
      error.value = String(e);
    }
  }

  return {
    roots,
    workspaceFile,
    error,
    loading,
    hasWorkspace,
    displayName,
    rootPath,
    rootPaths,
    hasAnyMd,
    addWorkspace,
    addFolderDirect,
    openFolder,
    openWorkspaceFile,
    removeWorkspace,
    removeRoot,
    restoreWorkspace,
    toggleDir,
    ensureDirExpanded,
    expandPathToNode,
    refreshRoot,
    refreshRootPreservingState,
    refreshParentOf,
    refreshDir,
    refreshUniqueParentsOf,
    createMdFile,
    createDir,
    renameMdFile,
    deleteMdFile,
    deleteMdFilesBatch,
    copyFile,
    copyFilesBatch,
    moveFile,
    moveFilesBatch,
    addFolderToCurrentWorkspace,
    saveCurrentWorkspace,
    saveAsNewWorkspace,
    recentWorkspaces,
    openDailyNote,
  };
});
