import type { FileTreeNode } from "@/lib/types";

export function flattenFiles(nodes: FileTreeNode[]) {
  const files: string[] = [];
  const visit = (node: FileTreeNode) => {
    if (!node.isDirectory) files.push(node.path);
    for (const child of node.children ?? []) visit(child);
  };
  for (const node of nodes) visit(node);
  return files;
}

export function filterFiles(files: string[], query: string) {
  const value = query.trim().toLowerCase();
  if (!value) return files;
  return files.filter((path) => path.toLowerCase().includes(value));
}
