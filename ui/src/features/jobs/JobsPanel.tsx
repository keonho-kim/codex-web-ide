import { JobList } from "./JobList";
import { JobToolbar } from "./JobToolbar";
import { useJobsPanel } from "./useJobsPanel";

export function JobsPanel({ sessionId }: { sessionId?: string }) {
  const jobs = useJobsPanel(sessionId);

  return (
    <div className="grid h-[calc(100%-38px)] grid-rows-[auto_minmax(0,1fr)] gap-2.5 overflow-auto p-2.5">
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
      <div className="grid min-h-0 grid-cols-[minmax(220px,34%)_minmax(0,1fr)] gap-2.5">
        <JobList
          jobs={jobs.orderedJobs}
          selectedJob={jobs.selectedJob}
          sessionId={sessionId}
          startPending={jobs.actions.startPending}
          onRerun={jobs.actions.rerun}
          onSelect={jobs.setSelectedJobId}
        />
        <pre className="h-[150px] overflow-auto rounded-md bg-ink p-2.5 text-xs whitespace-pre-wrap text-white">{jobs.selectedLog}</pre>
      </div>
    </div>
  );
}
