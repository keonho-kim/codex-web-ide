import fs from "node:fs/promises";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import type { FileTreeNode } from "../shared/types";
import type { EventBus } from "../events/eventBus";

const ignored = /(^|[/\\])(\.git[/\\]objects|node_modules|dist|build|target|\.next|\.venv)([/\\]|$)/;

export function safePath(root: string, input = ".") {
  const normalizedRoot = path.resolve(root);
  const resolved = path.resolve(normalizedRoot, input);
  if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
    throw new Error("Path escape blocked");
  }
  return resolved;
}

export class FileManager {
  private watchers = new Map<string, FSWatcher>();

  constructor(private events: EventBus) {}

  watch(sessionId: string, cwd: string) {
    if (this.watchers.has(sessionId)) return;
    const watcher = chokidar.watch(cwd, {
      ignored,
      ignoreInitial: true,
      depth: 12,
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 },
    });
    watcher.on("all", (_event, file) => {
      this.events.publish(sessionId, { type: "file.changed", path: path.relative(cwd, file) });
    });
    this.watchers.set(sessionId, watcher);
  }

  async tree(root: string, input = ".", depth = 3): Promise<FileTreeNode[]> {
    const base = safePath(root, input);
    const entries = await fs.readdir(base, { withFileTypes: true });
    const visible = entries
      .filter((entry) => !entry.name.startsWith(".") || [".agents", ".github"].includes(entry.name))
      .filter((entry) => !ignored.test(path.join(base, entry.name)))
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
        if (entry.isDirectory() && depth > 0) node.children = await this.tree(root, relative, depth - 1);
        return node;
      }),
    );
  }

  async read(root: string, input: string) {
    return fs.readFile(safePath(root, input), "utf8");
  }

  async write(root: string, input: string, content: string) {
    const file = safePath(root, input);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  }

  async create(root: string, input: string, isDirectory: boolean, content = "") {
    const target = safePath(root, input);
    if (isDirectory) {
      await fs.mkdir(target, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, { flag: "wx" });
    }
  }

  async rename(root: string, from: string, to: string) {
    await fs.rename(safePath(root, from), safePath(root, to));
  }

  async delete(root: string, input: string) {
    const target = safePath(root, input);
    if (target === path.resolve(root)) throw new Error("Cannot delete session root");
    await fs.rm(target, { recursive: true, force: false });
  }

  async search(root: string, query: string) {
    const results: Array<{ type: "file"; path: string; isDirectory: boolean }> = [];
    const needle = query.toLowerCase();
    async function walk(dir: string, depth: number) {
      if (depth < 0 || results.length >= 50) return;
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (results.length >= 50) break;
        const absolute = path.join(dir, entry.name);
        if (ignored.test(absolute)) continue;
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
}
