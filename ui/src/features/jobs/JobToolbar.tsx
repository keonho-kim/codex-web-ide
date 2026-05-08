import { Play, RefreshCw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Job } from "../../lib/types";

export function JobToolbar({
  cancelPending,
  command,
  selectedJob,
  startDisabled,
  onCancel,
  onCommandChange,
  onRefresh,
  onStart,
}: {
  cancelPending: boolean;
  command: string;
  selectedJob?: Job;
  startDisabled: boolean;
  onCancel(): void;
  onCommandChange(value: string): void;
  onRefresh(): void;
  onStart(): void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        className="w-[min(520px,100%)] min-w-0 rounded-md border border-control bg-canvas px-2.5 py-1.5 text-sm text-ink"
        value={command}
        onChange={(event) => onCommandChange(event.target.value)}
      />
      <Button type="button" disabled={startDisabled} onClick={onStart} variant="outline" size="icon-sm">
        <Play data-icon="inline-start" />
      </Button>
      {selectedJob?.status === "running" ? (
        <Button title="Cancel job" type="button" disabled={cancelPending} onClick={onCancel} variant="outline" size="icon-sm">
          <Square data-icon="inline-start" />
        </Button>
      ) : null}
      <Button type="button" onClick={onRefresh} variant="outline" size="icon-sm">
        <RefreshCw data-icon="inline-start" />
      </Button>
    </div>
  );
}
