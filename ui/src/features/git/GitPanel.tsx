import { GitChanges } from "./GitChanges";
import { GitControls } from "./GitControls";
import { useGitPanel } from "./useGitPanel";

export function GitPanel({ sessionId }: { sessionId?: string }) {
  const git = useGitPanel(sessionId);

  return (
    <div className="grid h-[calc(100%-38px)] grid-cols-[240px_minmax(0,1fr)] gap-4 overflow-auto p-2.5">
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
