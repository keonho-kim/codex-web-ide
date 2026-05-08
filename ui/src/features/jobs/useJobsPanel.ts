import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, splitCommand } from "../../lib/api";
import { confirmDangerousCommand, requiresDangerousApproval } from "../../lib/commandSafety";
import type { Job } from "../../lib/types";

export function useJobsPanel(sessionId?: string) {
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
  const commandArgs = splitCommand(command);

  return {
    command,
    orderedJobs,
    selectedJob,
    selectedLog,
    setCommand,
    setSelectedJobId,
    actions: {
      cancelSelected: () => {
        if (selectedJob) cancelJob.mutate(selectedJob.id);
      },
      refresh: () => void queryClient.invalidateQueries({ queryKey: ["jobs", sessionId] }),
      rerun: (job: Job) => {
        if (confirmDangerousCommand(job.command)) startJob.mutate(job.command);
      },
      start: () => {
        if (confirmDangerousCommand(commandArgs)) startJob.mutate(commandArgs);
      },
      cancelPending: cancelJob.isPending,
      startDisabled: !sessionId || startJob.isPending || commandArgs.length === 0,
      startPending: startJob.isPending,
    },
  };
}

export function formatDuration(job: Job) {
  if (!job.startedAt) return "-";
  const end = job.finishedAt ?? Date.now();
  return `${Math.max(0, Math.round((end - job.startedAt) / 1000))}s`;
}
