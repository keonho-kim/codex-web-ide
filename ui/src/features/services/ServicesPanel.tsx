import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, RefreshCw, Square } from "lucide-react";
import { commandRowClass, iconButtonClass, inputClass, logClass, mutedClass, panelContentClass } from "../../components/uiClasses";
import { api, splitCommand } from "../../lib/api";
import { confirmDangerousCommand, requiresDangerousApproval } from "../../lib/commandSafety";
import type { ServiceInstance } from "../../lib/types";

export function ServicesPanel({ sessionId }: { sessionId?: string }) {
  const queryClient = useQueryClient();
  const [command, setCommand] = useState("bun run dev");
  const services = useQuery({
    queryKey: ["services", sessionId],
    queryFn: () => api<ServiceInstance[]>(`/api/sessions/${sessionId}/services`),
    enabled: Boolean(sessionId),
  });
  const refreshServices = async () => {
    await queryClient.invalidateQueries({ queryKey: ["services", sessionId] });
  };
  const startService = useMutation({
    mutationFn: (commandArgs: string[]) =>
      api<ServiceInstance>(`/api/sessions/${sessionId}/services`, {
        method: "POST",
        body: { command: commandArgs, approvedDangerous: requiresDangerousApproval(commandArgs) },
      }),
    onSuccess: refreshServices,
  });
  const stopService = useMutation({
    mutationFn: (id: string) => api(`/api/sessions/${sessionId}/services/${id}/stop`, { method: "POST" }),
    onSuccess: refreshServices,
  });
  const restartService = useMutation({
    mutationFn: (id: string) => api<ServiceInstance>(`/api/sessions/${sessionId}/services/${id}/restart`, { method: "POST" }),
    onSuccess: refreshServices,
  });
  const latest = useMemo(() => services.data?.[services.data.length - 1], [services.data]);
  return (
    <div className={panelContentClass}>
      <div className={commandRowClass}>
        <input className={`${inputClass} w-[min(520px,100%)]`} value={command} onChange={(event) => setCommand(event.target.value)} />
        <button
          className={iconButtonClass}
          type="button"
          disabled={!sessionId || startService.isPending || splitCommand(command).length === 0}
          onClick={() => {
            const commandArgs = splitCommand(command);
            if (confirmDangerousCommand(commandArgs)) startService.mutate(commandArgs);
          }}
        >
          <Play size={15} />
        </button>
        <button className={iconButtonClass} type="button" onClick={() => void refreshServices()}>
          <RefreshCw size={15} />
        </button>
      </div>
      <div className="mt-2.5 grid grid-cols-[minmax(220px,34%)_minmax(0,1fr)] gap-2.5">
        <div className="grid gap-1.5">
          {services.data?.map((service) => (
            <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-subtle p-2" key={service.id}>
              <div className="min-w-0">
                <strong className="block overflow-hidden text-xs text-ellipsis whitespace-nowrap">{service.command.join(" ")}</strong>
                <span className="mt-1 block overflow-hidden text-xs text-ellipsis whitespace-nowrap text-muted">
                  {service.status} · pid {service.pid || "-"} · restarts {service.restartCount}
                </span>
              </div>
              <div className="flex gap-1">
                <button className={iconButtonClass} title="Restart service" type="button" disabled={restartService.isPending} onClick={() => restartService.mutate(service.id)}>
                  <RefreshCw size={14} />
                </button>
                <button className={iconButtonClass} title="Stop service" type="button" disabled={service.status === "stopped" || stopService.isPending} onClick={() => stopService.mutate(service.id)}>
                  <Square size={14} />
                </button>
              </div>
            </article>
          ))}
          {services.data?.length === 0 ? <p className={mutedClass}>No services yet.</p> : null}
        </div>
        <pre className={logClass}>{latest ? [...latest.stdout, ...latest.stderr].join("") || latest.status : "No service logs yet."}</pre>
      </div>
    </div>
  );
}
