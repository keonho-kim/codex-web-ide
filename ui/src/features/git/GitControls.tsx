import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { GitState } from "@/lib/types";

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
    <section className="grid gap-3 rounded-md border border-subtle bg-canvas p-3 shadow-[0_10px_24px_rgb(32_38_39/0.05)] xl:grid-cols-[minmax(180px,260px)_minmax(0,1fr)_auto] xl:items-end">
      <div className="min-w-0">
        <strong className="block truncate text-sm">{state?.branch || "No Git branch"}</strong>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted">
          <StatusPill>staged {state?.stagedCount ?? 0}</StatusPill>
          <StatusPill>unstaged {state?.unstagedCount ?? 0}</StatusPill>
          <StatusPill>untracked {state?.untrackedCount ?? 0}</StatusPill>
        </div>
        <p className="mt-2 text-xs text-muted">
          {state?.dirty ? "dirty" : "clean"} · ahead {state?.ahead ?? 0} / behind {state?.behind ?? 0}
          {state?.detached ? " · detached" : ""}
        </p>
      </div>
      <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(160px,0.8fr)_minmax(220px,1.2fr)]">
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
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            className="min-w-0 rounded-md border border-control bg-canvas px-2.5 py-1.5 text-sm text-ink"
            value={branchName}
            onChange={(event) => onBranchNameChange(event.target.value)}
            placeholder="New branch"
          />
          <Button type="button" disabled={!sessionId || !branchName.trim() || pending.createBranch} onClick={onCreateBranch} variant="outline" size="sm">
            Create
          </Button>
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 md:col-span-2">
        <input
          className="min-w-0 rounded-md border border-control bg-canvas px-2.5 py-1.5 text-sm text-ink"
          value={commitMessage}
          onChange={(event) => onCommitMessageChange(event.target.value)}
          placeholder="Commit message"
        />
        <Button type="button" disabled={!sessionId || !commitMessage.trim() || pending.commit} onClick={onCommit} variant="outline" size="sm">
          Commit
        </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 xl:justify-end">
        <Button type="button" disabled={!sessionId || pending.pull} onClick={onPull} variant="outline" size="sm">
          Pull
        </Button>
        <Button type="button" disabled={!sessionId || pending.push} onClick={onPush} variant="outline" size="sm">
          Push
        </Button>
      </div>
    </section>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return <span className="rounded-md border border-subtle bg-panel px-2 py-1">{children}</span>;
}
