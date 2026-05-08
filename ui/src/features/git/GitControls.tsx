import type { GitState } from "../../lib/types";

type GitControlsProps = {
  branchName: string;
  branches: string[];
  commitMessage: string;
  pending: {
    commit: boolean;
    createBranch: boolean;
    pull: boolean;
    push: boolean;
  };
  sessionId?: string;
  state?: GitState;
  onBranchNameChange(value: string): void;
  onCheckout(branch: string): void;
  onCommit(): void;
  onCommitMessageChange(value: string): void;
  onCreateBranch(): void;
  onPull(): void;
  onPush(): void;
};

export function GitControls({
  branchName,
  branches,
  commitMessage,
  pending,
  sessionId,
  state,
  onBranchNameChange,
  onCheckout,
  onCommit,
  onCommitMessageChange,
  onCreateBranch,
  onPull,
  onPush,
}: GitControlsProps) {
  return (
    <div className="grid content-start gap-2">
      <strong>{state?.branch || "No Git branch"}</strong>
      <p className="text-xs text-muted">
        staged {state?.stagedCount ?? 0} / unstaged {state?.unstagedCount ?? 0} / untracked {state?.untrackedCount ?? 0}
      </p>
      <p className="text-xs text-muted">
        {state?.dirty ? "dirty" : "clean"} · ahead {state?.ahead ?? 0} / behind {state?.behind ?? 0}
        {state?.detached ? " · detached" : ""}
      </p>
      <div className="grid gap-2">
        <select
          className="min-w-0 rounded-md border border-control bg-canvas px-2.5 py-1.5 text-sm text-ink"
          value={state?.branch ?? ""}
          disabled={!sessionId}
          onChange={(event) => onCheckout(event.target.value)}
        >
          <option value="" disabled>
            Select branch
          </option>
          {branches.map((branch) => (
            <option key={branch} value={branch}>
              {branch}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            className="min-w-0 rounded-md border border-control bg-canvas px-2.5 py-1.5 text-sm text-ink"
            value={branchName}
            onChange={(event) => onBranchNameChange(event.target.value)}
            placeholder="New branch"
          />
          <button
            className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!sessionId || !branchName.trim() || pending.createBranch}
            onClick={onCreateBranch}
          >
            Create
          </button>
        </div>
        <input
          className="min-w-0 rounded-md border border-control bg-canvas px-2.5 py-1.5 text-sm text-ink"
          value={commitMessage}
          onChange={(event) => onCommitMessageChange(event.target.value)}
          placeholder="Commit message"
        />
        <button
          className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!sessionId || !commitMessage.trim() || pending.commit}
          onClick={onCommit}
        >
          Commit
        </button>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!sessionId || pending.pull}
            onClick={onPull}
          >
            Pull
          </button>
          <button
            className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!sessionId || pending.push}
            onClick={onPush}
          >
            Push
          </button>
        </div>
      </div>
    </div>
  );
}
