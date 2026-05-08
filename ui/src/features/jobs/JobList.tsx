import { cn } from "../../lib/classes";
import type { Job } from "../../lib/types";
import { formatDuration } from "./useJobsPanel";

export function JobList({
  jobs,
  selectedJob,
  startPending,
  sessionId,
  onRerun,
  onSelect,
}: {
  jobs: Job[];
  selectedJob?: Job;
  startPending: boolean;
  sessionId?: string;
  onRerun(job: Job): void;
  onSelect(id: string): void;
}) {
  return (
    <div className="min-h-0 overflow-auto">
      {jobs.map((job) => (
        <article className={cn("mb-1 grid gap-1 rounded-md border border-subtle p-2 text-xs", job.id === selectedJob?.id ? "border-selected-border bg-selected text-primary" : "bg-canvas")} key={job.id}>
          <button className="grid gap-1 text-left" type="button" onClick={() => onSelect(job.id)}>
            <strong className="overflow-hidden text-ellipsis whitespace-nowrap">{job.command.join(" ")}</strong>
            <span className="text-xs text-muted">
              {job.status} · {formatDuration(job)} {job.exitCode !== undefined ? `· exit ${job.exitCode}` : ""}
            </span>
          </button>
          <div>
            <button
              className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!sessionId || startPending}
              onClick={() => onRerun(job)}
            >
              Rerun
            </button>
          </div>
        </article>
      ))}
      {jobs.length === 0 ? <p className="text-xs text-muted">No jobs yet.</p> : null}
    </div>
  );
}
