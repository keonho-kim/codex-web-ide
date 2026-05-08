import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, splitCommand } from "../../lib/api";
import { confirmDangerousCommand, requiresDangerousApproval } from "../../lib/commandSafety";
import { getErrorMessage } from "../../lib/errors";
import type { ServiceInstance } from "../../lib/types";

export function useServicesPanel(sessionId?: string) {
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

  const items = services.data ?? [];
  const latest = useMemo(() => newestService(items), [items]);
  const latestLog = latest ? [...latest.stdout, ...latest.stderr].join("") || latest.status : "No service logs yet.";
  const commandArgs = splitCommand(command);

  return {
    command,
    latestLog,
    services: items,
    setCommand,
    actions: {
      refresh: refreshServices,
      restart: (id: string) => restartService.mutate(id),
      start: () => {
        if (confirmDangerousCommand(commandArgs)) startService.mutate(commandArgs);
      },
      stop: (id: string) => stopService.mutate(id),
      error: startService.error
        ? getErrorMessage(startService.error)
        : stopService.error
          ? getErrorMessage(stopService.error)
          : restartService.error
            ? getErrorMessage(restartService.error)
            : null,
      restartPending: restartService.isPending,
      startDisabled: !sessionId || startService.isPending || commandArgs.length === 0,
      stopPending: stopService.isPending,
    },
  };
}

function newestService(services: ServiceInstance[]) {
  return services.reduce<ServiceInstance | undefined>((latest, service) => (!latest || service.startedAt > latest.startedAt ? service : latest), undefined);
}
