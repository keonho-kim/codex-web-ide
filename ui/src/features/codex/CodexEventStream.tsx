import { Activity } from "lucide-react";
import { useUiStore } from "../../store/uiStore";

export function CodexEventStream({ running, sessionId }: { running: boolean; sessionId?: string }) {
  const events = useUiStore((state) => (sessionId ? state.codexEvents[sessionId] ?? [] : []));

  return (
    <div className="codex-event-stream">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Activity size={14} />
        <span>{running ? "Codex running" : "Codex events"}</span>
      </div>
      <div className="mt-1 flex min-w-0 gap-1 overflow-x-auto">
        {events.length ? (
          events.map((event) => (
            <span className="status-pill max-w-[220px] shrink-0" title={event.detail || event.label} key={event.id}>
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">{event.label}</span>
              {event.detail ? <span className="overflow-hidden text-ellipsis whitespace-nowrap text-ink">{event.detail}</span> : null}
            </span>
          ))
        ) : (
          <span className="empty-state">{running ? "Waiting for Codex events." : "No Codex events yet."}</span>
        )}
      </div>
    </div>
  );
}
