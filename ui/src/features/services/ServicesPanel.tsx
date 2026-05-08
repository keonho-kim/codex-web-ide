import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, RefreshCw, Square } from "lucide-react";
import { api, splitCommand } from "../../lib/api";
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
    mutationFn: () => api<ServiceInstance>(`/api/sessions/${sessionId}/services`, { method: "POST", body: { command: splitCommand(command) } }),
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
    <div className="panel-content services-panel">
      <div className="command-row">
        <input value={command} onChange={(event) => setCommand(event.target.value)} />
        <button type="button" disabled={!sessionId || startService.isPending || splitCommand(command).length === 0} onClick={() => startService.mutate()}>
          <Play size={15} />
        </button>
        <button type="button" onClick={() => void refreshServices()}>
          <RefreshCw size={15} />
        </button>
      </div>
      <div className="service-grid">
        <div className="service-list">
          {services.data?.map((service) => (
            <article className="service-row" key={service.id}>
              <div>
                <strong>{service.command.join(" ")}</strong>
                <span>
                  {service.status} · pid {service.pid || "-"} · restarts {service.restartCount}
                </span>
              </div>
              <div className="service-actions">
                <button title="Restart service" type="button" disabled={restartService.isPending} onClick={() => restartService.mutate(service.id)}>
                  <RefreshCw size={14} />
                </button>
                <button title="Stop service" type="button" disabled={service.status === "stopped" || stopService.isPending} onClick={() => stopService.mutate(service.id)}>
                  <Square size={14} />
                </button>
              </div>
            </article>
          ))}
          {services.data?.length === 0 ? <p className="empty">No services yet.</p> : null}
        </div>
        <pre>{latest ? [...latest.stdout, ...latest.stderr].join("") || latest.status : "No service logs yet."}</pre>
      </div>
    </div>
  );
}
