import { html as diffToHtml } from "diff2html";
import "diff2html/bundles/css/diff2html.min.css";

export function GitDiffView({ diff, selectedFile }: { diff?: string; selectedFile?: string }) {
  if (!selectedFile) return null;
  if (!diff) {
    return <pre className="mt-2 max-h-[155px] overflow-auto rounded-md border border-subtle bg-panel p-2 text-xs text-ink">No diff.</pre>;
  }
  return (
    <div
      className="mt-2 max-h-[155px] overflow-auto rounded-md border border-subtle bg-panel p-2 text-xs text-ink [&_pre]:whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: diffToHtml(diff, { drawFileList: false, matching: "lines" }) }}
    />
  );
}
