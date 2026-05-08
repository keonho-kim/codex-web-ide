import { Play, RefreshCw, Square } from "lucide-react";
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
      <button className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={startDisabled} onClick={onStart}>
        <Play size={15} />
      </button>
      {selectedJob?.status === "running" ? (
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title="Cancel job"
          type="button"
          disabled={cancelPending}
          onClick={onCancel}
        >
          <Square size={15} />
        </button>
      ) : null}
      <button className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={onRefresh}>
        <RefreshCw size={15} />
      </button>
    </div>
  );
}
