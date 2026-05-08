import { execa } from "execa";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import type { GitFileStatus, GitState } from "../shared/types";
import type { EventBus } from "../events/eventBus";
import { safePath } from "./fileManager";

export class GitManager {
  private watchers = new Map<string, FSWatcher>();

  private async git(cwd: string, args: string[]) {
    return execa("git", args, { cwd });
  }

  watch(sessionId: string, cwd: string, events: EventBus) {
    if (this.watchers.has(sessionId)) return;
    const gitDir = path.join(cwd, ".git");
    const watcher = chokidar.watch([path.join(gitDir, "HEAD"), path.join(gitDir, "refs", "heads")], {
      ignoreInitial: true,
      depth: 3,
    });
    watcher.on("all", async () => {
      events.publish(sessionId, { type: "git.state.updated", state: await this.state(cwd) });
    });
    this.watchers.set(sessionId, watcher);
  }

  async unwatch(sessionId: string) {
    const watcher = this.watchers.get(sessionId);
    if (!watcher) return;
    this.watchers.delete(sessionId);
    await watcher.close();
  }

  async state(cwd: string): Promise<GitState> {
    try {
      const { stdout } = await this.git(cwd, ["status", "--porcelain=v2", "--branch"]);
      return parsePorcelainV2(stdout);
    } catch {
      return {
        branch: null,
        detached: false,
        commit: null,
        dirty: false,
        stagedCount: 0,
        unstagedCount: 0,
        untrackedCount: 0,
      };
    }
  }

  async status(cwd: string): Promise<GitFileStatus[]> {
    const { stdout } = await this.git(cwd, ["status", "--porcelain=v2"]);
    return stdout
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => parseStatusLine(line));
  }

  async diff(cwd: string, file?: string, staged = false) {
    if (file) safePath(cwd, file);
    const args = ["diff", "--no-ext-diff"];
    if (staged) args.push("--staged");
    if (file) args.push("--", file);
    const { stdout } = await this.git(cwd, args);
    return stdout;
  }

  async stage(cwd: string, files: string[]) {
    files.forEach((file) => safePath(cwd, file));
    await this.git(cwd, ["add", "--", ...files]);
  }

  async unstage(cwd: string, files: string[]) {
    files.forEach((file) => safePath(cwd, file));
    await this.git(cwd, ["restore", "--staged", "--", ...files]);
  }

  async commit(cwd: string, message: string) {
    await this.git(cwd, ["commit", "-m", message]);
  }

  async push(cwd: string) {
    await this.git(cwd, ["push"]);
  }

  async pull(cwd: string) {
    await this.git(cwd, ["pull", "--ff-only"]);
  }

  async branch(cwd: string) {
    const { stdout } = await this.git(cwd, ["branch", "--format", "%(refname:short)"]);
    return stdout.split("\n").filter(Boolean);
  }

  async checkout(cwd: string, branch: string) {
    await this.git(cwd, ["checkout", branch]);
  }

  async createAndCheckout(cwd: string, branch: string) {
    await this.git(cwd, ["checkout", "-b", branch]);
  }
}

function parsePorcelainV2(stdout: string): GitState {
  const state: GitState = {
    branch: null,
    detached: false,
    commit: null,
    dirty: false,
    stagedCount: 0,
    unstagedCount: 0,
    untrackedCount: 0,
  };
  for (const line of stdout.split("\n")) {
    if (line.startsWith("# branch.oid ")) state.commit = line.slice("# branch.oid ".length);
    if (line.startsWith("# branch.head ")) {
      const head = line.slice("# branch.head ".length);
      state.detached = head === "(detached)";
      state.branch = state.detached ? null : head;
    }
    if (line.startsWith("# branch.upstream ")) state.upstream = line.slice("# branch.upstream ".length);
    if (line.startsWith("# branch.ab ")) {
      const match = /\+(\d+) -(\d+)/.exec(line);
      if (match) {
        state.ahead = Number(match[1]);
        state.behind = Number(match[2]);
      }
    }
    if (line.startsWith("? ")) state.untrackedCount += 1;
    if (line.startsWith("1 ") || line.startsWith("2 ") || line.startsWith("u ")) {
      const xy = line.slice(2, 4);
      if (xy[0] !== ".") state.stagedCount += 1;
      if (xy[1] !== ".") state.unstagedCount += 1;
    }
  }
  state.dirty = state.stagedCount + state.unstagedCount + state.untrackedCount > 0;
  return state;
}

function parseStatusLine(line: string): GitFileStatus[] {
  if (line.startsWith("? ")) return [{ path: line.slice(2), index: "?", worktree: "?", untracked: true }];
  if (!(line.startsWith("1 ") || line.startsWith("2 ") || line.startsWith("u "))) return [];
  const parts = line.split(" ");
  const xy = parts[1] || "..";
  const file = parts.at(-1);
  return file ? [{ path: file, index: xy[0], worktree: xy[1], untracked: false }] : [];
}
