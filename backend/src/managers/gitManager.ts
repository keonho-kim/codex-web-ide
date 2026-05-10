import { execa } from "execa";
import path from "node:path";
import fs from "node:fs";
import chokidar, { type FSWatcher } from "chokidar";
import type { GitFileStatus, GitState } from "../shared/types";
import type { EventBus } from "../events/eventBus";
import { safeFsPath } from "./files/path";
import { parsePorcelainV2, parseStatus } from "./git/porcelain";
import { assertSupportedProjectRootSync } from "./projects/pathPolicy";

export class GitManager {
  private watchers = new Map<string, FSWatcher>();

  private async git(cwd: string, args: string[]) {
    return execa("git", args, { cwd });
  }

  watch(sessionId: string, cwd: string, events: EventBus) {
    if (this.watchers.has(sessionId)) return;
    try {
      assertSupportedProjectRootSync(cwd);
    } catch {
      return;
    }
    const gitDir = path.join(cwd, ".git");
    if (!isDirectory(gitDir)) return;
    const watcher = chokidar.watch([path.join(gitDir, "HEAD"), path.join(gitDir, "refs", "heads")], {
      ignoreInitial: true,
      ignorePermissionErrors: true,
      depth: 3,
    });
    watcher.on("all", async () => {
      events.publish(sessionId, { type: "git.state.updated", state: await this.state(cwd) });
    });
    watcher.on("error", (error) => {
      if (isTransientWatchError(error)) {
        console.warn(`Git watcher skipped inaccessible path for session ${sessionId}: ${describeWatchError(error)}`);
        return;
      }
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
    try {
      const { stdout } = await this.git(cwd, ["status", "--porcelain=v2"]);
      return parseStatus(stdout);
    } catch {
      return [];
    }
  }

  async diff(cwd: string, file?: string, staged = false) {
    if (file) await safeFsPath(cwd, file);
    const args = ["diff", "--no-ext-diff"];
    if (staged) args.push("--staged");
    if (file) args.push("--", file);
    try {
      const { stdout } = await this.git(cwd, args);
      return stdout;
    } catch {
      return "";
    }
  }

  async stage(cwd: string, files: string[]) {
    await assertGitPaths(cwd, files);
    await this.git(cwd, ["add", "--", ...files]);
  }

  async unstage(cwd: string, files: string[]) {
    await assertGitPaths(cwd, files);
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
    try {
      const { stdout } = await this.git(cwd, ["branch", "--format", "%(refname:short)"]);
      return stdout.split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  async checkout(cwd: string, branch: string) {
    await assertExistingBranch(cwd, branch, this.branch.bind(this));
    await this.git(cwd, ["checkout", branch]);
  }

  async createAndCheckout(cwd: string, branch: string) {
    await assertValidBranchName(cwd, branch);
    await this.git(cwd, ["checkout", "-b", branch]);
  }
}

async function assertGitPaths(cwd: string, files: string[]) {
  await Promise.all(files.map((file) => safeFsPath(cwd, file)));
}

async function assertExistingBranch(cwd: string, branch: string, listBranches: (cwd: string) => Promise<string[]>) {
  assertSafeBranchArg(branch);
  if (!(await listBranches(cwd)).includes(branch)) throw new Error("Git branch not found");
}

async function assertValidBranchName(cwd: string, branch: string) {
  assertSafeBranchArg(branch);
  try {
    await execa("git", ["check-ref-format", "--branch", branch], { cwd });
  } catch {
    throw new Error("Invalid Git branch name");
  }
}

function assertSafeBranchArg(branch: string) {
  if (!branch.trim() || branch.startsWith("-")) throw new Error("Invalid Git branch name");
}

function isDirectory(input: string) {
  try {
    return fs.statSync(input).isDirectory();
  } catch {
    return false;
  }
}

function isTransientWatchError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "EACCES" || code === "EPERM" || code === "EINVAL" || code === "ENOENT";
}

function describeWatchError(error: unknown) {
  if (!error || typeof error !== "object") return String(error);
  const item = error as { code?: unknown; path?: unknown; filename?: unknown };
  return [item.code, item.path ?? item.filename].filter(Boolean).join(" ");
}
