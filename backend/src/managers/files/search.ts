import fs from "node:fs/promises";
import path from "node:path";
import { ignoredPathPattern } from "./ignore";

export async function searchFiles(root: string, query: string) {
  const results: Array<{ type: "file"; path: string; isDirectory: boolean }> = [];
  const needle = query.toLowerCase();
  async function walk(dir: string, depth: number) {
    if (depth < 0 || results.length >= 50) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (results.length >= 50) break;
      const absolute = path.join(dir, entry.name);
      if (ignoredPathPattern.test(absolute)) continue;
      const relative = path.relative(root, absolute);
      if (relative.toLowerCase().includes(needle)) {
        results.push({ type: "file", path: relative, isDirectory: entry.isDirectory() });
      }
      if (entry.isDirectory() && !entry.name.startsWith(".")) await walk(absolute, depth - 1);
    }
  }
  await walk(root, 5);
  return results;
}
