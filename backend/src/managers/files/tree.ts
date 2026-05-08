import fs from "node:fs/promises";
import path from "node:path";
import type { FileTreeNode } from "../../shared/types";
import { ignoredPathPattern, isVisibleFileName } from "./ignore";
import { safeFsPath } from "./path";

export async function readFileTree(root: string, input = ".", depth = 3): Promise<FileTreeNode[]> {
  const base = await safeFsPath(root, input);
  const entries = await fs.readdir(base, { withFileTypes: true });
  const visible = entries
    .filter((entry) => isVisibleFileName(entry.name))
    .filter((entry) => !ignoredPathPattern.test(path.join(base, entry.name)))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  return Promise.all(
    visible.slice(0, 500).map(async (entry) => {
      const absolute = path.join(base, entry.name);
      const relative = path.relative(root, absolute) || ".";
      const node: FileTreeNode = {
        id: relative,
        name: entry.name,
        path: relative,
        isDirectory: entry.isDirectory(),
      };
      if (entry.isDirectory() && depth > 0) node.children = await readFileTree(root, relative, depth - 1);
      return node;
    }),
  );
}
