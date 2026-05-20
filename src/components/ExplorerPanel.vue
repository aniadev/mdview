<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { confirm } from '@tauri-apps/plugin-dialog';
import { useWorkspaceStore } from '../stores/workspace';
import { useTabsStore } from '../stores/tabs';
import { useFsUiStore } from '../stores/fsui';
import { useUiStore } from '../stores/ui';
import { useI18n } from '../i18n';
import FileTreeNode from './FileTreeNode.vue';
import InlineFilenameInput from './InlineFilenameInput.vue';
import TocPanel from './TocPanel.vue';

const { t } = useI18n();

const workspace = useWorkspaceStore();
const tabs = useTabsStore();
const fsui = useFsUiStore();
const ui = useUiStore();

const rootInputRef = ref<InstanceType<typeof InlineFilenameInput> | null>(null);
const rootDirInputRef = ref<InstanceType<typeof InlineFilenameInput> | null>(null);

function onTocNavigate(index: number) {
  ui.triggerNavigateHeading(index);
}

const rootCtxMenu = ref<{ visible: boolean; x: number; y: number; rootPath: string }>({
  visible: false,
  x: 0,
  y: 0,
  rootPath: '',
});

function onWindowClick() {
  if (fsui.ctxMenu.visible) fsui.closeContextMenu();
  if (rootCtxMenu.value.visible) rootCtxMenu.value.visible = false;
}

function resolveTargetDir(): string | null {
  for (const [path, isDir] of fsui.selectedItems) {
    if (isDir) return path;
  }
  for (const [path] of fsui.selectedItems) {
    return parentOf(path);
  }
  return workspace.rootPaths[0] ?? null;
}

function onWindowKeydown(e: KeyboardEvent) {
  const evtTarget = e.target as HTMLElement | null;
  const tag = evtTarget?.tagName?.toLowerCase();
  const inEditable = tag === 'input' || tag === 'textarea'
    || evtTarget?.closest?.('.cm-editor') || evtTarget?.closest?.('.xterm');

  // Delete / Backspace — no modifier needed
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (inEditable || fsui.selectedCount === 0) return;
    e.preventDefault();
    void deleteSelected();
    return;
  }

  if (!(e.metaKey || e.ctrlKey)) return;
  const key = e.key.toLowerCase();
  if (key !== 'c' && key !== 'v') return;
  if (inEditable) return;

  if (key === 'c') {
    if (fsui.selectedCount === 0) return;
    e.preventDefault();
    const entries = [...fsui.selectedItems.entries()];
    const paths = entries.map(([p]) => p);
    const isDirs = entries.map(([, d]) => d);
    fsui.setClipboardMulti(paths, isDirs, 'copy');
    const n = paths.length;
    ui.showToast(`Copied ${n} file${n === 1 ? '' : 's'}`);
  } else if (key === 'v') {
    if (!fsui.hasClipboard) return;
    const targetDir = resolveTargetDir();
    if (!targetDir) return;
    e.preventDefault();
    void ctxPaste(targetDir);
  }
}

async function deleteSelected() {
  const files = [...fsui.selectedItems.entries()].filter(([, isDir]) => !isDir);
  if (files.length === 0) return;
  const n = files.length;
  const msg = n === 1
    ? `Delete "${baseName(files[0][0])}"? This cannot be undone.`
    : `Delete ${n} files? This cannot be undone.`;
  const ok = await confirm(msg, { title: 'Delete', kind: 'warning' });
  if (!ok) return;
  fsui.clearSelection();
  await workspace.deleteMdFilesBatch(files.map(([p]) => p));
}

onMounted(() => {
  window.addEventListener('click', onWindowClick);
  window.addEventListener('keydown', onWindowKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('click', onWindowClick);
  window.removeEventListener('keydown', onWindowKeydown);
});

async function ctxNewFile() {
  fsui.requestCreateIn(
    fsui.ctxMenu.isDir ? fsui.ctxMenu.targetPath : parentOf(fsui.ctxMenu.targetPath),
  );
  fsui.closeContextMenu();
}

async function ctxNewFolder() {
  fsui.requestCreateDirIn(
    fsui.ctxMenu.isDir ? fsui.ctxMenu.targetPath : parentOf(fsui.ctxMenu.targetPath),
  );
  fsui.closeContextMenu();
}

async function ctxRename() {
  fsui.requestRename(fsui.ctxMenu.targetPath);
  fsui.closeContextMenu();
}

async function ctxDelete() {
  const target = fsui.ctxMenu.targetPath;
  fsui.closeContextMenu();
  const ok = await confirm(`Delete "${baseName(target)}"? This cannot be undone.`, {
    title: 'Delete file',
    kind: 'warning',
  });
  if (!ok) return;
  try {
    await workspace.deleteMdFile(target);
    tabs.handleFileDeleted(target);
  } catch (e) {
    workspace.error = String(e);
  }
}

function baseName(p: string) {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] || p;
}

function parentOf(p: string) {
  const norm = p.replace(/\\/g, '/');
  const idx = norm.lastIndexOf('/');
  return idx >= 0 ? norm.slice(0, idx) : '';
}

async function onRootCreateCommit(rootPath: string, filename: string) {
  try {
    const newPath = await workspace.createMdFile(rootPath, filename);
    fsui.cancelInputs();
    const base = newPath.replace(/\\/g, '/').split('/').pop() ?? filename;
    await tabs.openFile(newPath, base);
  } catch (e) {
    rootInputRef.value?.setError(String(e));
  }
}

async function onRootCreateDirCommit(rootPath: string, name: string) {
  try {
    await workspace.createDir(rootPath, name);
    fsui.cancelInputs();
  } catch (e) {
    rootDirInputRef.value?.setError(String(e));
  }
}

function onRootCtxMenu(e: MouseEvent, rootPath: string) {
  if (workspace.roots.length <= 1) return;
  rootCtxMenu.value = { visible: true, x: e.clientX, y: e.clientY, rootPath };
}

function removeRootFromWs() {
  const path = rootCtxMenu.value.rootPath;
  rootCtxMenu.value = { visible: false, x: 0, y: 0, rootPath: '' };
  workspace.removeRoot(path);
}

function startRootCreate(rootPath: string) {
  const activeFilePath = tabs.activeTab?.path?.replace(/\\/g, '/');
  const normalizedRoot = rootPath.replace(/\\/g, '/');
  if (activeFilePath?.startsWith(normalizedRoot + '/')) {
    const lastSlash = activeFilePath.lastIndexOf('/');
    fsui.requestCreateIn(activeFilePath.slice(0, lastSlash));
  } else {
    fsui.requestCreateIn(rootPath);
  }
}

function startRootCreateDir(rootPath: string) {
  fsui.requestCreateDirIn(rootPath);
}

// ─── Copy / Cut / Paste ─────────────────────────────────────────────────────

function ctxCopy() {
  const target = fsui.ctxMenu.targetPath;
  if (fsui.isMultiSelected(target) && fsui.selectedCount > 1) {
    // Apply to all selected
    const entries = [...fsui.selectedItems.entries()];
    fsui.setClipboardMulti(entries.map(([p]) => p), entries.map(([, d]) => d), 'copy');
  } else {
    fsui.setClipboard(target, fsui.ctxMenu.isDir, 'copy');
  }
  fsui.closeContextMenu();
}

function ctxCut() {
  // Cut is file-only (dirs would need recursive delete — deferred)
  const target = fsui.ctxMenu.targetPath;
  if (fsui.ctxMenu.isDir) {
    fsui.closeContextMenu();
    return;
  }
  if (fsui.isMultiSelected(target) && fsui.selectedCount > 1) {
    // Only copy files from selection (skip dirs)
    const entries = [...fsui.selectedItems.entries()].filter(([, d]) => !d);
    fsui.setClipboardMulti(entries.map(([p]) => p), entries.map(() => false), 'cut');
  } else {
    fsui.setClipboard(target, false, 'cut');
  }
  fsui.closeContextMenu();
}

async function ctxPaste(targetDir: string) {
  if (!fsui.hasClipboard || fsui.clipSources.length === 0) return;
  fsui.closeContextMenu();
  const op = fsui.clipOp;
  const sources = [...fsui.clipSources];
  fsui.clearClipboard();
  if (op === 'copy') {
    await workspace.copyFilesBatch(sources, targetDir);
  } else if (op === 'cut') {
    await workspace.moveFilesBatch(sources, targetDir);
  }
}
</script>

<template>
  <div class="explorer-panel">
    <header class="sidebar-header">
      <span class="ws-name" :title="workspace.workspaceFile ?? workspace.rootPath ?? ''">
        {{ workspace.hasWorkspace ? workspace.displayName : 'Explorer' }}
      </span>
      <div class="sidebar-actions">
        <button
          v-if="!workspace.hasWorkspace"
          class="icon-btn"
          :title="t('explorer.addFolderOrWs')"
          @click="workspace.addWorkspace()"
        >
          <Icon icon="lucide:plus" width="14" height="14" />
        </button>
        <template v-else>
          <button
            class="icon-btn"
            :title="t('explorer.addFolderToWs')"
            @click="workspace.addFolderToCurrentWorkspace()"
          >
            <Icon icon="lucide:folder-plus" width="14" height="14" />
          </button>
          <button
            v-if="!workspace.workspaceFile"
            class="icon-btn"
            :title="t('explorer.saveWs')"
            @click="workspace.saveAsNewWorkspace()"
          >
            <Icon icon="lucide:save" width="14" height="14" />
          </button>
          <button class="icon-btn" :title="t('explorer.closeWs')" @click="workspace.removeWorkspace()">
            <Icon icon="lucide:x" width="14" height="14" />
          </button>
        </template>
      </div>
    </header>

    <div class="sidebar-activity-row">
      <button
        class="activity-btn"
        :class="{ active: ui.sidebarView === 'explorer' }"
        :title="t('explorer.title')"
        @click="ui.setSidebarView('explorer')"
      >
        <Icon icon="lucide:files" width="14" height="14" />
      </button>
      <button
        class="activity-btn"
        :class="{ active: ui.sidebarView === 'outline' }"
        :title="t('explorer.outline')"
        @click="ui.setSidebarView('outline')"
      >
        <Icon icon="lucide:list-tree" width="14" height="14" />
      </button>
      <button
        class="activity-btn"
        :class="{ active: ui.bottomPanelVisible }"
        :title="t('terminal.toggle')"
        @click="ui.toggleBottomPanel()"
      >
        <Icon icon="lucide:terminal" width="14" height="14" />
      </button>
      <!-- <button
        class="activity-btn"
        :title="t('sidebar.collapse')"
        @click="ui.toggleSidebar()"
      >
        <Icon icon="lucide:panel-left-close" width="14" height="14" />
      </button> -->
    </div>

    <div class="sidebar-body">
      <div v-if="!workspace.hasWorkspace" class="sidebar-empty">
        <p>{{ t('explorer.noFolder') }}</p>
        <div v-if="workspace.recentWorkspaces.length" class="recent-list">
          <div class="recent-header">{{ t('explorer.recent') }}</div>
          <button
            v-for="(p, i) in workspace.recentWorkspaces"
            :key="i"
            class="recent-item"
            :title="p"
            @click="
              p.toLowerCase().endsWith('.code-workspace')
                ? workspace.openWorkspaceFile(p)
                : workspace.openFolder(p)
            "
          >
            <Icon
              :icon="
                p.toLowerCase().endsWith('.code-workspace') ? 'lucide:book-open' : 'lucide:folder'
              "
              width="14"
              height="14"
            />
            <span>{{ p.replace(/\\/g, '/').split('/').filter(Boolean).pop() || p }}</span>
            <span class="recent-path">{{
              p.replace(/\\/g, '/').split('/').filter(Boolean).slice(0, -1).join('/') || '/'
            }}</span>
          </button>
        </div>
        <button class="primary" @click="workspace.addFolderDirect()">{{ t('explorer.addFolder') }}</button>
        <button @click="workspace.addWorkspace()">{{ t('explorer.openWorkspace') }}</button>
      </div>

      <TocPanel
        v-else-if="ui.sidebarView === 'outline'"
        :headings="ui.currentHeadings"
        :active-index="ui.activeHeadingIndex"
        @navigate="onTocNavigate"
      />

      <template v-else-if="ui.sidebarView === 'explorer'">
        <div v-if="workspace.loading" class="sidebar-empty" style="height: auto; padding: 16px">
          <p>{{ t('explorer.loading') }}</p>
        </div>
        <template v-else>
          <section v-for="root in workspace.roots" :key="root.path" class="ws-root">
            <div class="ws-root-header" @contextmenu.prevent="onRootCtxMenu($event, root.path)">
              <span class="ws-root-name" :title="root.path">{{ root.name }}</span>
              <span class="ws-root-actions">
                <button
                  v-if="fsui.hasClipboard"
                  class="icon-btn ws-root-add ws-root-add-visible"
                  :title="t('ctx.pasteHere')"
                  @click="ctxPaste(root.path)"
                >
                  <Icon icon="lucide:clipboard-paste" width="14" height="14" />
                </button>
                <button
                  class="icon-btn ws-root-add"
                  :title="t('explorer.refresh')"
                  @click="workspace.refreshRootPreservingState(root.path)"
                >
                  <Icon icon="lucide:refresh-cw" width="14" height="14" />
                </button>
                <button
                  class="icon-btn ws-root-add"
                  :title="t('explorer.newFile')"
                  @click="startRootCreate(root.path)"
                >
                  <Icon icon="lucide:file-plus" width="14" height="14" />
                </button>
                <button
                  class="icon-btn ws-root-add"
                  :title="t('explorer.newFolder')"
                  @click="startRootCreateDir(root.path)"
                >
                  <Icon icon="lucide:folder-plus" width="14" height="14" />
                </button>
              </span>
            </div>
            <div v-if="root.loadError" class="ws-root-error" :title="root.path">
              {{ root.loadError }}
            </div>
            <ul v-else class="tree">
              <li v-if="fsui.pendingCreateInDir === root.path" class="tree-node">
                <InlineFilenameInput
                  ref="rootInputRef"
                  :depth="0"
                  :placeholder="t('input.filename')"
                  @commit="v => onRootCreateCommit(root.path, v)"
                  @cancel="fsui.cancelInputs()"
                />
              </li>
              <li v-if="fsui.pendingCreateDirInDir === root.path" class="tree-node">
                <InlineFilenameInput
                  ref="rootDirInputRef"
                  :depth="0"
                  :placeholder="t('input.foldername')"
                  @commit="v => onRootCreateDirCommit(root.path, v)"
                  @cancel="fsui.cancelInputs()"
                />
              </li>
              <FileTreeNode
                v-for="node in root.children"
                :key="node.path"
                :node="node"
                :depth="0"
              />
            </ul>
          </section>
          <div v-if="!workspace.hasAnyMd" class="sidebar-empty" style="height: auto; padding: 16px">
            <p>{{ t('explorer.noMdFiles') }}</p>
          </div>
        </template>
      </template>
    </div>

    <Teleport to="body">
      <div
        v-if="fsui.ctxMenu.visible"
        class="ctx-menu"
        :style="{ left: fsui.ctxMenu.x + 'px', top: fsui.ctxMenu.y + 'px' }"
        @click.stop
      >
        <button v-if="fsui.ctxMenu.isDir" class="ctx-item" @click="ctxNewFile">{{ t('ctx.newFile') }}</button>
        <button v-if="fsui.ctxMenu.isDir" class="ctx-item" @click="ctxNewFolder">{{ t('ctx.newFolder') }}</button>
        <button v-if="fsui.ctxMenu.isMdFile" class="ctx-item" @click="ctxRename">{{ t('ctx.rename') }}</button>
        <button v-if="fsui.ctxMenu.isMdFile" class="ctx-item" @click="ctxDelete">{{ t('ctx.delete') }}</button>
        <div class="ctx-separator"></div>
        <button class="ctx-item" @click="ctxCopy">{{ t('ctx.copy') }}</button>
        <button v-if="!fsui.ctxMenu.isDir" class="ctx-item" @click="ctxCut">{{ t('ctx.cut') }}</button>
        <template v-if="fsui.hasClipboard">
          <div class="ctx-separator"></div>
          <button class="ctx-item" @click="ctxPaste(fsui.ctxMenu.isDir ? fsui.ctxMenu.targetPath : parentOf(fsui.ctxMenu.targetPath))">{{ t('ctx.paste') }}</button>
        </template>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="rootCtxMenu.visible"
        class="ctx-menu"
        :style="{ left: rootCtxMenu.x + 'px', top: rootCtxMenu.y + 'px' }"
        @click.stop
      >
        <button class="ctx-item" @click="removeRootFromWs">{{ t('ctx.removeRoot') }}</button>
      </div>
    </Teleport>
  </div>
</template>

<style>
.explorer-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.sidebar-activity-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-tab-bar);
}

.sidebar-activity-row .activity-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sidebar-activity-row .activity-btn:hover {
  color: var(--text);
  background: var(--bg-app);
}

.sidebar-activity-row .activity-btn.active {
  color: var(--text);
  background: var(--bg-app);
}

.sidebar-activity-row .activity-btn:last-child {
  margin-left: auto;
}

.ws-root {
  margin-bottom: 4px;
}

.ws-root-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 4px 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.ws-root-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.ws-root-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.ws-root-add {
  width: 18px;
  height: 18px;
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.1s;
}

.ws-root:hover .ws-root-add {
  opacity: 1;
}

.ws-root-add.ws-root-add-visible {
  opacity: 1;
}

.ws-root-error {
  padding: 6px 12px;
  font-size: 11px;
  color: var(--danger);
}

.ctx-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
</style>
