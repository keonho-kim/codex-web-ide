import fs from "node:fs/promises";
import path from "node:path";
import { isIgnoredPath, isVisibleFileName } from "@backend/managers/files/ignore";

const DEFAULT_SEARCH_DEPTH = 12;
const MAX_RESULTS = 50;

export async function searchFiles(root: string, query: string) {
  const results: Array<{ type: "file"; path: string; isDirectory: boolean }> = [];
  const needle = query.toLowerCase();
  async function walk(dir: string, depth: number) {
    if (depth < 0 || results.length >= MAX_RESULTS) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (results.length >= MAX_RESULTS) break;
      if (!isVisibleFileName(entry.name)) continue;
      const absolute = path.join(dir, entry.name);
      if (isIgnoredPath(absolute)) continue;
      const relative = path.relative(root, absolute);
      if (relative.toLowerCase().includes(needle)) {
        results.push({ type: "file", path: relative, isDirectory: entry.isDirectory() });
      }
      if (entry.isDirectory()) await walk(absolute, depth - 1);
    }
  }
  await walk(root, DEFAULT_SEARCH_DEPTH);
  return results;
}
