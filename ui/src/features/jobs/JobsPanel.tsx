import { JobList } from "./JobList";
import { JobToolbar } from "./JobToolbar";
import { useJobsPanel } from "./useJobsPanel";

export function JobsPanel({ sessionId }: { sessionId?: string }) {
  const jobs = useJobsPanel(sessionId);

  return (
    <div className="panel-grid grid-rows-[auto_minmax(0,1fr)]">
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
      {jobs.actions.error ? <p className="error-text m-0">{jobs.actions.error}</p> : null}
      <div className="split-grid">
        <JobList
          jobs={jobs.orderedJobs}
          selectedJob={jobs.selectedJob}
          sessionId={sessionId}
          startPending={jobs.actions.startPending}
          onRerun={jobs.actions.rerun}
          onSelect={jobs.setSelectedJobId}
        />
        <pre className="log-output">{jobs.selectedLog}</pre>
      </div>
    </div>
  );
}
