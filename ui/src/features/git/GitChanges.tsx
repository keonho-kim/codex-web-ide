import { Button } from "@/components/ui/button";
import { cn } from "@/lib/classes";
import type { GitFileStatus } from "@/lib/types";
import { GitDiffView } from "@/features/git/GitDiffView";

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
    <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(260px,34%)_minmax(0,1fr)]">
      <section className="min-h-0 overflow-auto rounded-md border border-subtle bg-canvas p-2 font-mono text-xs">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <h3 className="text-xs font-semibold font-sans text-muted uppercase">Changes</h3>
          <span className="text-muted">{files.length}</span>
        </div>
        <div className="grid gap-1.5">
          {files.map((file) => (
            <GitFileRow
              file={file}
              key={`${file.path}-${file.index}-${file.worktree}`}
              selected={file.path === selectedFile}
              onSelectFile={onSelectFile}
              onStage={onStage}
              onUnstage={onUnstage}
            />
          ))}
          {files.length === 0 ? <p className="m-0 rounded-md border border-dashed border-subtle bg-panel p-3 font-sans text-xs text-muted">No changes.</p> : null}
        </div>
      </section>
      <section className="min-h-[260px] overflow-auto rounded-md border border-subtle bg-canvas p-3">
        <GitDiffView selectedFile={selectedFile} stagedDiff={stagedDiff} unstagedDiff={unstagedDiff} />
        {!selectedFile && files.length > 0 ? <p className="m-0 text-xs text-muted">Select a changed file to inspect the diff.</p> : null}
      </section>
    </div>
  );
}

function GitFileRow({ file, selected, onSelectFile, onStage, onUnstage }: { file: GitFileStatus; selected: boolean; onSelectFile(path: string): void; onStage(path: string): void; onUnstage(path: string): void }) {
  return (
    <article className={cn("grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 rounded-md border p-1.5", selected ? "border-selected-border bg-selected" : "border-subtle bg-panel")}>
      <button className="min-w-0 overflow-hidden text-left font-mono text-xs text-ellipsis whitespace-nowrap" type="button" onClick={() => onSelectFile(file.path)}>
        <span className="mr-2 inline-flex min-w-8 justify-center rounded bg-canvas px-1 text-muted">
          {file.index}
          {file.worktree}
        </span>
        {file.path}
      </button>
      <Button type="button" onClick={() => onStage(file.path)} variant="outline" size="xs">
        Stage
      </Button>
      <Button type="button" onClick={() => onUnstage(file.path)} variant="outline" size="xs">
        Unstage
      </Button>
    </article>
  );
}
