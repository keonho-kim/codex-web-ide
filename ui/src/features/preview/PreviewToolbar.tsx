import { ExternalLink, Play, RefreshCw, RotateCw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        className="command-input"
        value={command}
        onChange={(event) => onCommandChange(event.target.value)}
      />
      <Button type="button" disabled={startDisabled} onClick={onStart} variant="outline" size="icon-sm">
        <Play data-icon="inline-start" />
      </Button>
      {runningPreviews.length > 1 ? (
        <select
          className="field-input"
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
          <Button title="Reload iframe" type="button" onClick={onReload} variant="outline" size="icon-sm">
            <RotateCw data-icon="inline-start" />
          </Button>
          <Button title="Restart preview" type="button" onClick={onRestart} variant="outline" size="icon-sm">
            <RefreshCw data-icon="inline-start" />
          </Button>
          <Button title="Stop preview" type="button" onClick={onStop} variant="outline" size="icon-sm">
            <Square data-icon="inline-start" />
          </Button>
          <Button asChild title="Open preview" variant="outline" size="icon-sm">
            <a href={activePreview.publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink data-icon="inline-start" />
            </a>
          </Button>
        </>
      ) : null}
    </div>
  );
}
