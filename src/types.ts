export interface FsEntry {
  name: string;
  path: string;
  is_dir: boolean;
  has_md: boolean;
}

export interface TreeNode extends FsEntry {
  children?: TreeNode[];
  expanded?: boolean;
  loading?: boolean;
}

export interface WorkspaceRoot {
  path: string;
  name: string;
  exists: boolean;
  loading: boolean;
  loadError: string | null;
  children: TreeNode[];
}

export interface CodeWorkspaceFolder {
  name: string;
  path: string;
  exists: boolean;
}

export interface CodeWorkspace {
  folders: CodeWorkspaceFolder[];
}
