import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, RefreshCw, Square } from "lucide-react";
import { buttonClass, commandRowClass, iconButtonClass, inputClass, logClass, mutedClass, panelContentClass, selectedListButtonClass } from "../../components/uiClasses";
import { api, splitCommand } from "../../lib/api";
import type { Job } from "../../lib/types";

export function JobsPanel({ sessionId }: { sessionId?: string }) {
  const queryClient = useQueryClient();
  const [command, setCommand] = useState("bun run build");
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const jobs = useQuery({
    queryKey: ["jobs", sessionId],
    queryFn: () => api<Job[]>(`/api/sessions/${sessionId}/jobs`),
    enabled: Boolean(sessionId),
  });
  const startJob = useMutation({
    mutationFn: (commandArgs: string[]) => api<Job>(`/api/sessions/${sessionId}/commands/job`, { method: "POST", body: { command: commandArgs } }),
    onSuccess: async (job) => {
      setSelectedJobId(job.id);
      await queryClient.invalidateQueries({ queryKey: ["jobs", sessionId] });
    },
  });
  const cancelJob = useMutation({
    mutationFn: (id: string) => api<Job>(`/api/sessions/${sessionId}/jobs/${id}/cancel`, { method: "POST" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["jobs", sessionId] }),
  });
  const orderedJobs = useMemo(() => [...(jobs.data ?? [])].reverse(), [jobs.data]);
  const selectedJob = orderedJobs.find((job) => job.id === selectedJobId) ?? orderedJobs[0];
  const selectedLog = selectedJob ? [...selectedJob.stdout, ...selectedJob.stderr].join("") || selectedJob.status : "No jobs yet.";

  return (
    <div className={`${panelContentClass} grid grid-rows-[auto_minmax(0,1fr)] gap-2.5`}>
      <div className={commandRowClass}>
        <input className={`${inputClass} w-[min(520px,100%)]`} value={command} onChange={(event) => setCommand(event.target.value)} />
        <button
          className={iconButtonClass}
          type="button"
          disabled={!sessionId || startJob.isPending || splitCommand(command).length === 0}
          onClick={() => startJob.mutate(splitCommand(command))}
        >
          <Play size={15} />
        </button>
        {selectedJob?.status === "running" ? (
          <button className={iconButtonClass} title="Cancel job" type="button" disabled={cancelJob.isPending} onClick={() => cancelJob.mutate(selectedJob.id)}>
            <Square size={15} />
          </button>
        ) : null}
        <button className={iconButtonClass} type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ["jobs", sessionId] })}>
          <RefreshCw size={15} />
        </button>
      </div>
      <div className="grid min-h-0 grid-cols-[minmax(220px,34%)_minmax(0,1fr)] gap-2.5">
        <div className="min-h-0 overflow-auto">
          {orderedJobs.map((job) => (
            <article className={`mb-1 grid gap-1 rounded-md border border-[#ececf0] p-2 text-xs ${job.id === selectedJob?.id ? selectedListButtonClass : "bg-white"}`} key={job.id}>
              <button className="grid gap-1 text-left" type="button" onClick={() => setSelectedJobId(job.id)}>
                <strong className="overflow-hidden text-ellipsis whitespace-nowrap">{job.command.join(" ")}</strong>
                <span className={mutedClass}>
                  {job.status} · {formatDuration(job)} {job.exitCode !== undefined ? `· exit ${job.exitCode}` : ""}
                </span>
              </button>
              <div>
                <button
                  className={buttonClass}
                  type="button"
                  disabled={!sessionId || startJob.isPending}
                  onClick={() => startJob.mutate(job.command)}
                >
                  Rerun
                </button>
              </div>
            </article>
          ))}
          {orderedJobs.length === 0 ? <p className={mutedClass}>No jobs yet.</p> : null}
        </div>
        <pre className={logClass}>{selectedLog}</pre>
      </div>
    </div>
  );
}

function formatDuration(job: Job) {
  if (!job.startedAt) return "-";
  const end = job.finishedAt ?? Date.now();
  return `${Math.max(0, Math.round((end - job.startedAt) / 1000))}s`;
}
