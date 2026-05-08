import { ExternalLink, Play, RefreshCw, RotateCw, Square } from "lucide-react";
import type { PreviewInstance } from "../../lib/types";

type PreviewToolbarProps = {
  activePreview?: PreviewInstance;
  command: string;
  runningPreviews: PreviewInstance[];
  startDisabled: boolean;
  onCommandChange(value: string): void;
  onReload(): void;
  onRestart(): void;
  onSelectPreview(id: string): void;
  onStart(): void;
  onStop(): void;
};

export function PreviewToolbar({
  activePreview,
  command,
  runningPreviews,
  startDisabled,
  onCommandChange,
  onReload,
  onRestart,
  onSelectPreview,
  onStart,
  onStop,
}: PreviewToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        className="w-[min(520px,100%)] min-w-0 rounded-md border border-control bg-canvas px-2.5 py-1.5 text-sm text-ink"
        value={command}
        onChange={(event) => onCommandChange(event.target.value)}
      />
      <button
        className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={startDisabled}
        onClick={onStart}
      >
        <Play size={15} />
      </button>
      {runningPreviews.length > 1 ? (
        <select
          className="min-w-0 rounded-md border border-control bg-canvas px-2.5 py-1.5 text-sm text-ink"
          value={activePreview?.id ?? ""}
          onChange={(event) => onSelectPreview(event.target.value)}
        >
          {runningPreviews.map((preview) => (
            <option key={preview.id} value={preview.id}>
              {preview.command.join(" ")}
            </option>
          ))}
        </select>
      ) : null}
      {activePreview ? (
        <>
          <button className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink" title="Reload iframe" type="button" onClick={onReload}>
            <RotateCw size={15} />
          </button>
          <button className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink" title="Restart preview" type="button" onClick={onRestart}>
            <RefreshCw size={15} />
          </button>
          <button className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink" title="Stop preview" type="button" onClick={onStop}>
            <Square size={15} />
          </button>
          <a className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink" href={activePreview.publicUrl} target="_blank" rel="noreferrer" title="Open preview">
            <ExternalLink size={15} />
          </a>
        </>
      ) : null}
    </div>
  );
}
