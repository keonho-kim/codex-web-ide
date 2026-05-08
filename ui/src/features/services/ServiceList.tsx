import { RefreshCw, Square } from "lucide-react";
import type { ServiceInstance } from "../../lib/types";

export function ServiceList({
  restartPending,
  services,
  stopPending,
  onRestart,
  onStop,
}: {
  restartPending: boolean;
  services: ServiceInstance[];
  stopPending: boolean;
  onRestart(id: string): void;
  onStop(id: string): void;
}) {
  return (
    <div className="grid gap-1.5">
      {services.map((service) => (
        <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-subtle p-2" key={service.id}>
          <div className="min-w-0">
            <strong className="block overflow-hidden text-xs text-ellipsis whitespace-nowrap">{service.command.join(" ")}</strong>
            <span className="mt-1 block overflow-hidden text-xs text-ellipsis whitespace-nowrap text-muted">
              {service.status} · pid {service.pid || "-"} · restarts {service.restartCount}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
              title="Restart service"
              type="button"
              disabled={restartPending}
              onClick={() => onRestart(service.id)}
            >
              <RefreshCw size={14} />
            </button>
            <button
              className="inline-flex min-h-7 items-center rounded-md border border-control bg-canvas px-2 py-1 text-ink disabled:cursor-not-allowed disabled:opacity-50"
              title="Stop service"
              type="button"
              disabled={service.status === "stopped" || stopPending}
              onClick={() => onStop(service.id)}
            >
              <Square size={14} />
            </button>
          </div>
        </article>
      ))}
      {services.length === 0 ? <p className="text-xs text-muted">No services yet.</p> : null}
    </div>
  );
}
