import { GitChanges } from "@/features/git/GitChanges";
import { GitControls } from "@/features/git/GitControls";
import { useGitPanel } from "@/features/git/useGitPanel";

export function GitPanel({ sessionId }: { sessionId?: string }) {
  const git = useGitPanel(sessionId);

  return (
    <div className="grid h-full grid-cols-[260px_minmax(0,1fr)] gap-5 overflow-auto p-4 max-[900px]:grid-cols-1">
      {git.actions.error ? <p className="col-span-full m-0 text-xs text-destructive">{git.actions.error}</p> : null}
      <GitControls
        branchName={git.branchName}
        branches={git.branches}
        commitMessage={git.commitMessage}
        pending={git.actions.pending}
        sessionId={sessionId}
        state={git.state}
        onBranchNameChange={git.setBranchName}
        onCheckout={git.actions.checkout}
        onCommit={git.actions.commit}
        onCommitMessageChange={git.setCommitMessage}
        onCreateBranch={git.actions.createBranch}
        onPull={git.actions.pull}
        onPush={git.actions.push}
      />
      <GitChanges
        files={git.status}
        selectedFile={git.selectedFile}
        stagedDiff={git.stagedDiff}
        unstagedDiff={git.unstagedDiff}
        onSelectFile={git.setSelectedFile}
        onStage={git.actions.stage}
        onUnstage={git.actions.unstage}
      />
    </div>
  );
}
