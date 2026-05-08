import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, RefreshCw, Square } from "lucide-react";
import { commandRowClass, iconButtonClass, inputClass, logClass, panelContentClass } from "../../components/uiClasses";
import { api, splitCommand } from "../../lib/api";
import type { Job } from "../../lib/types";

export function JobsPanel({ sessionId }: { sessionId?: string }) {
  const queryClient = useQueryClient();
  const [command, setCommand] = useState("bun run build");
  const jobs = useQuery({
    queryKey: ["jobs", sessionId],
    queryFn: () => api<Job[]>(`/api/sessions/${sessionId}/jobs`),
    enabled: Boolean(sessionId),
  });
  const startJob = useMutation({
    mutationFn: () => api<Job>(`/api/sessions/${sessionId}/commands/job`, { method: "POST", body: { command: splitCommand(command) } }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["jobs", sessionId] }),
  });
  const cancelJob = useMutation({
    mutationFn: (id: string) => api<Job>(`/api/sessions/${sessionId}/jobs/${id}/cancel`, { method: "POST" }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["jobs", sessionId] }),
  });
  const latest = useMemo(() => jobs.data?.[jobs.data.length - 1], [jobs.data]);
  return (
    <div className={panelContentClass}>
      <div className={commandRowClass}>
        <input className={`${inputClass} w-[min(520px,100%)]`} value={command} onChange={(event) => setCommand(event.target.value)} />
        <button className={iconButtonClass} type="button" disabled={!sessionId || startJob.isPending || splitCommand(command).length === 0} onClick={() => startJob.mutate()}>
          <Play size={15} />
        </button>
        {latest?.status === "running" ? (
          <button className={iconButtonClass} title="Cancel job" type="button" disabled={cancelJob.isPending} onClick={() => cancelJob.mutate(latest.id)}>
            <Square size={15} />
          </button>
        ) : null}
        <button className={iconButtonClass} type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ["jobs", sessionId] })}>
          <RefreshCw size={15} />
        </button>
      </div>
      <pre className={`${logClass} mt-2.5`}>{latest ? [...latest.stdout, ...latest.stderr].join("") || latest.status : "No jobs yet."}</pre>
    </div>
  );
}
