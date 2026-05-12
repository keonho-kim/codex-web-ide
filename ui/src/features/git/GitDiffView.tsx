import { html as diffToHtml } from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";

export function GitDiffView({ selectedFile, stagedDiff, unstagedDiff }: { selectedFile?: string; stagedDiff?: string; unstagedDiff?: string }) {
  if (!selectedFile) return null;
  if (!stagedDiff && !unstagedDiff) {
    return <pre className="min-h-[220px] overflow-auto rounded-md border border-subtle bg-panel p-3 text-xs text-ink">No diff.</pre>;
  }
  return (
    <div className="grid gap-3">
      <DiffBlock label="Staged" diff={stagedDiff} />
      <DiffBlock label="Unstaged" diff={unstagedDiff} />
    </div>
  );
}

function DiffBlock({ diff, label }: { diff?: string; label: string }) {
  if (!diff) return null;
  return (
    <section>
      <strong className="mb-1 block text-xs text-muted">{label}</strong>
      <div
        className="max-h-[58vh] min-h-[220px] overflow-auto rounded-md border border-subtle bg-panel p-3 text-xs text-ink [&_pre]:whitespace-pre-wrap"
        dangerouslySetInnerHTML={{ __html: diffToHtml(diff, { drawFileList: false, matching: "lines" }) }}
      />
    </section>
  );
}
