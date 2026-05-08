import type { PreviewInstance } from "../../lib/types";

export function PreviewFrame({ iframeVersion, preview }: { iframeVersion: number; preview?: PreviewInstance }) {
  if (!preview) return <p className="empty-state">No preview selected.</p>;
  return <iframe key={`${preview.id}:${iframeVersion}`} className="h-full w-full rounded-md border border-control" title="Preview" src={preview.publicUrl} />;
}
