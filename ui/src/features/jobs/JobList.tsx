import { Button } from "@/components/ui/button";
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
            <Button type="button" disabled={!sessionId || startPending} onClick={() => onRerun(job)} variant="outline" size="sm">
              Rerun
            </Button>
          </div>
        </article>
      ))}
      {jobs.length === 0 ? <p className="text-xs text-muted">No jobs yet.</p> : null}
    </div>
  );
}
