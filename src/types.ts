export interface WikiPage {
  path: string;
  title: string;
  order: number | null;
  lang: string | null;
  content: string;
}

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: TreeNode[];
  pagePath?: string;
}

export interface WikiMeta {
  title?: string;
  languages: string[];
  planOrder?: string[];
  raw?: unknown;
}

export interface WikiModel {
  sourceLabel: string;
  pages: WikiPage[];
  tree: TreeNode[];
  meta: WikiMeta;
  homePath: string | null;
  languages: string[];
}

export type FileMap = Map<string, string>;

export type LoadSource =
  | { kind: "bundled" }
  | { kind: "picker" }
  | { kind: "drop" }
  | { kind: "fsaccess"; handle: FileSystemDirectoryHandle };
