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
