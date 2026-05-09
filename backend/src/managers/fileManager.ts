import fs from "node:fs/promises";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import type { EventBus } from "../events/eventBus";
import { ignoredPathPattern } from "./files/ignore";
import { safeFsPath } from "./files/path";
import { searchFiles } from "./files/search";
import { readFileTree } from "./files/tree";
export { safePath } from "./files/path";

const DEFAULT_FILE_TREE_DEPTH = 12;

export class FileManager {
  private watchers = new Map<string, FSWatcher>();

  constructor(private events: EventBus) {}

  watch(sessionId: string, cwd: string) {
    if (this.watchers.has(sessionId)) return;
    const watcher = chokidar.watch(cwd, {
      ignored: ignoredPathPattern,
      ignoreInitial: true,
      depth: 12,
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 },
    });
    watcher.on("all", (_event, file) => {
      this.events.publish(sessionId, { type: "file.changed", path: path.relative(cwd, file) });
    });
    watcher.on("error", (error) => {
      if (isTransientWatchError(error)) return;
      console.error(error);
    });
    this.watchers.set(sessionId, watcher);
  }

  async unwatch(sessionId: string) {
    const watcher = this.watchers.get(sessionId);
    if (!watcher) return;
    this.watchers.delete(sessionId);
    await watcher.close();
  }

  tree(root: string, input = ".", depth = DEFAULT_FILE_TREE_DEPTH) {
    return readFileTree(root, input, depth);
  }

  async read(root: string, input: string) {
    return fs.readFile(await safeFsPath(root, input), "utf8");
  }

  async write(root: string, input: string, content: string) {
    const file = await safeFsPath(root, input);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  }

  async create(root: string, input: string, isDirectory: boolean, content = "") {
    const target = await safeFsPath(root, input);
    if (isDirectory) {
      await fs.mkdir(target, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, { flag: "wx" });
    }
  }

  async rename(root: string, from: string, to: string) {
    await fs.rename(await safeFsPath(root, from), await safeFsPath(root, to));
  }

  async delete(root: string, input: string) {
    const target = await safeFsPath(root, input);
    if (target === path.resolve(root)) throw new Error("Cannot delete session root");
    await fs.rm(target, { recursive: true, force: false });
  }

  async search(root: string, query: string) {
    return searchFiles(root, query);
  }
}

function isTransientWatchError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "EINVAL" || code === "ENOENT";
}
