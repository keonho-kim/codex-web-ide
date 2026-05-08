import type { GitFileStatus } from "../../lib/types";
import { GitDiffView } from "./GitDiffView";

type GitChangesProps = {
  diff?: string;
  files: GitFileStatus[];
  selectedFile?: string;
  onSelectFile(path: string): void;
  onStage(path: string): void;
  onUnstage(path: string): void;
};

export function GitChanges({ diff, files, selectedFile, onSelectFile, onStage, onUnstage }: GitChangesProps) {
  return (
    <div className="grid gap-1 font-mono text-xs">
      {files.map((file) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5" key={`${file.path}-${file.index}-${file.worktree}`}>
          <button
            className="inline-flex min-h-7 items-center justify-start gap-1.5 overflow-hidden rounded-md border border-control bg-canvas px-2.5 py-1 text-left font-mono text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={() => onSelectFile(file.path)}
          >
            {file.index}
            {file.worktree} {file.path}
          </button>
          <button
            className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={() => onStage(file.path)}
          >
            Stage
          </button>
          <button
            className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={() => onUnstage(file.path)}
          >
            Unstage
          </button>
        </div>
      ))}
      <GitDiffView diff={diff} selectedFile={selectedFile} />
    </div>
  );
}
