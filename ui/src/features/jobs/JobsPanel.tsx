import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, RefreshCw, Square } from "lucide-react";
import { api, splitCommand } from "../../lib/api";
import { cn } from "../../lib/classes";
import { confirmDangerousCommand, requiresDangerousApproval } from "../../lib/commandSafety";
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
    mutationFn: (commandArgs: string[]) =>
      api<Job>(`/api/sessions/${sessionId}/commands/job`, {
        method: "POST",
        body: { command: commandArgs, approvedDangerous: requiresDangerousApproval(commandArgs) },
      }),
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
    <div className="grid h-[calc(100%-38px)] grid-rows-[auto_minmax(0,1fr)] gap-2.5 overflow-auto p-2.5">
      <div className="flex items-center gap-2">
        <input
          className="w-[min(520px,100%)] min-w-0 rounded-md border border-control bg-canvas px-2.5 py-1.5 text-sm text-ink"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
        />
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!sessionId || startJob.isPending || splitCommand(command).length === 0}
          onClick={() => {
            const commandArgs = splitCommand(command);
            if (confirmDangerousCommand(commandArgs)) startJob.mutate(commandArgs);
          }}
        >
          <Play size={15} />
        </button>
        {selectedJob?.status === "running" ? (
          <button
            className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
            title="Cancel job"
            type="button"
            disabled={cancelJob.isPending}
            onClick={() => cancelJob.mutate(selectedJob.id)}
          >
            <Square size={15} />
          </button>
        ) : null}
        <button
          className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => void queryClient.invalidateQueries({ queryKey: ["jobs", sessionId] })}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      <div className="grid min-h-0 grid-cols-[minmax(220px,34%)_minmax(0,1fr)] gap-2.5">
        <div className="min-h-0 overflow-auto">
          {orderedJobs.map((job) => (
            <article
              className={cn("mb-1 grid gap-1 rounded-md border border-subtle p-2 text-xs", job.id === selectedJob?.id ? "border-selected-border bg-selected text-primary" : "bg-canvas")}
              key={job.id}
            >
              <button className="grid gap-1 text-left" type="button" onClick={() => setSelectedJobId(job.id)}>
                <strong className="overflow-hidden text-ellipsis whitespace-nowrap">{job.command.join(" ")}</strong>
                <span className="text-xs text-muted">
                  {job.status} · {formatDuration(job)} {job.exitCode !== undefined ? `· exit ${job.exitCode}` : ""}
                </span>
              </button>
              <div>
                <button
                  className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-control bg-canvas px-2.5 py-1 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={!sessionId || startJob.isPending}
                  onClick={() => {
                    if (confirmDangerousCommand(job.command)) startJob.mutate(job.command);
                  }}
                >
                  Rerun
                </button>
              </div>
            </article>
          ))}
          {orderedJobs.length === 0 ? <p className="text-xs text-muted">No jobs yet.</p> : null}
        </div>
        <pre className="h-[150px] overflow-auto rounded-md bg-ink p-2.5 text-xs whitespace-pre-wrap text-white">{selectedLog}</pre>
      </div>
    </div>
  );
}

function formatDuration(job: Job) {
  if (!job.startedAt) return "-";
  const end = job.finishedAt ?? Date.now();
  return `${Math.max(0, Math.round((end - job.startedAt) / 1000))}s`;
}
