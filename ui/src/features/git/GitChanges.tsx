import { Button } from "@/components/ui/button";
import type { GitFileStatus } from "../../lib/types";
import { GitDiffView } from "./GitDiffView";

type GitChangesProps = {
  files: GitFileStatus[];
  selectedFile?: string;
  stagedDiff?: string;
  unstagedDiff?: string;
  onSelectFile(path: string): void;
  onStage(path: string): void;
  onUnstage(path: string): void;
};

export function GitChanges({ files, selectedFile, stagedDiff, unstagedDiff, onSelectFile, onStage, onUnstage }: GitChangesProps) {
  return (
    <div className="grid gap-1 font-mono text-xs">
      {files.map((file) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5" key={`${file.path}-${file.index}-${file.worktree}`}>
          <Button
            className="min-w-0 justify-start overflow-hidden font-mono"
            variant="outline"
            size="sm"
            type="button"
            onClick={() => onSelectFile(file.path)}
          >
            {file.index}
            {file.worktree} {file.path}
          </Button>
          <Button type="button" onClick={() => onStage(file.path)} variant="outline" size="sm">
            Stage
          </Button>
          <Button type="button" onClick={() => onUnstage(file.path)} variant="outline" size="sm">
            Unstage
          </Button>
        </div>
      ))}
      <GitDiffView selectedFile={selectedFile} stagedDiff={stagedDiff} unstagedDiff={unstagedDiff} />
    </div>
  );
}
