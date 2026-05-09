import { JobList } from "./JobList";
import { JobToolbar } from "./JobToolbar";
import { useJobsPanel } from "./useJobsPanel";

export function JobsPanel({ sessionId }: { sessionId?: string }) {
  const jobs = useJobsPanel(sessionId);

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-auto p-4">
      <JobToolbar
        cancelPending={jobs.actions.cancelPending}
        command={jobs.command}
        selectedJob={jobs.selectedJob}
        startDisabled={jobs.actions.startDisabled}
        onCancel={jobs.actions.cancelSelected}
        onCommandChange={jobs.setCommand}
        onRefresh={jobs.actions.refresh}
        onStart={jobs.actions.start}
      />
      {jobs.actions.error ? <p className="m-0 text-xs text-destructive">{jobs.actions.error}</p> : null}
      <div className="grid min-h-0 grid-cols-[minmax(240px,34%)_minmax(0,1fr)] gap-4 max-[900px]:grid-cols-1">
        <JobList
          jobs={jobs.orderedJobs}
          selectedJob={jobs.selectedJob}
          sessionId={sessionId}
          startPending={jobs.actions.startPending}
          onRerun={jobs.actions.rerun}
          onSelect={jobs.setSelectedJobId}
        />
        <pre className="min-h-[220px] overflow-auto rounded-md bg-ink p-4 text-xs whitespace-pre-wrap text-white">{jobs.selectedLog}</pre>
      </div>
    </div>
  );
}
