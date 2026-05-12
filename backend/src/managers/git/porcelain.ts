import type { GitFileStatus, GitState } from "@backend/shared/types";

export function parsePorcelainV2(stdout: string): GitState {
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

export function parseStatus(stdout: string): GitFileStatus[] {
  return stdout
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => parseStatusLine(line));
}

function parseStatusLine(line: string): GitFileStatus[] {
  if (line.startsWith("? ")) return [{ path: line.slice(2), index: "?", worktree: "?", untracked: true }];
  const xy = line.slice(2, 4);
  const file = trackedPath(line);
  return file ? [{ path: file, index: xy[0], worktree: xy[1], untracked: false }] : [];
}

function trackedPath(line: string) {
  if (line.startsWith("1 ")) return fieldAfterSpaces(line, 8);
  if (line.startsWith("2 ")) return fieldAfterSpaces(line, 9)?.split("\t")[0];
  if (line.startsWith("u ")) return fieldAfterSpaces(line, 10);
  return null;
}

function fieldAfterSpaces(line: string, count: number) {
  let index = -1;
  for (let seen = 0; seen < count; seen += 1) {
    index = line.indexOf(" ", index + 1);
    if (index === -1) return null;
  }
  return line.slice(index + 1);
}
